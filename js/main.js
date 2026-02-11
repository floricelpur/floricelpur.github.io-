// ========== GLOBAL VARIABLES ==========
let generatedValues = [];
let stopGenerationFlag = false;
let histogramChart = null;

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    initializeC4PrimeTable();
    initializeUI();
    setupEventListeners();
    updateSpecTypeUI();
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    
    document.addEventListener('keydown', function(e) {
        const generateBtn = document.getElementById('generateBtn');
        if (e.key === 'Enter' && generateBtn && !generateBtn.disabled) {
            generateValues();
        }
    });
});

// ========== GENERATION FUNCTIONS ==========
async function generateValues() {
    try {
        const specType = getInputValue('specType');
        const lsl = parseNumber(getInputValue('lsl'));
        const usl = parseNumber(getInputValue('usl'));
        const targetCpk = parseNumber(getInputValue('targetCpk'));
        const sampleSize = parseInt(getInputValue('sampleSize'));
        const subgroupSize = parseInt(getInputValue('subgroupSize'));
        const decimals = parseInt(getInputValue('decimals'));
        const minVal = parseNumber(getInputValue('minVal'));
        const maxVal = parseNumber(getInputValue('maxVal'));
        const sigmaPercent = parseInt(getInputValue('sigmaSlider'));
        const centerPercent = parseInt(getInputValue('centerSlider'));
        const forceRange = getInputChecked('forceRange');
        const autoAdjust = getInputChecked('autoAdjust');
        const maxAttempts = parseInt(getInputValue('maxIterations'));
        const tolerance = parseFloat(getInputValue('tolerance'));
        const adjFactor = parseFloat(getInputValue('adjFactor'));

        if (isNaN(lsl) || isNaN(usl) || isNaN(targetCpk) || isNaN(sampleSize) ||
            isNaN(minVal) || isNaN(maxVal) || minVal >= maxVal) {
            alert('Please enter valid numbers for all required fields.');
            return;
        }

        if (specType === 'bilateral' && lsl >= usl) {
            alert('LSL must be less than USL for bilateral specification.');
            return;
        }

        setButtonState('generateBtn', true);
        setButtonState('stopBtn', false);
        stopGenerationFlag = false;
        updateProgress(10);

        const statusDisplay = document.getElementById('statusDisplay');
        const modeText = forceRange ? "🔒 RESTRICTED MODE" : "⚡ FREE MODE";
        statusDisplay.textContent = `${modeText}\nGenerating ${sampleSize} values\nTarget Cpk: ${targetCpk}\nSearching...`;

        const rangeWidth = maxVal - minVal;
        const currentMean = minVal + (rangeWidth * centerPercent / 100);
        let currentSigma = rangeWidth * sigmaPercent / 100 * 0.5;

        updateProgress(30);

        let bestValues = null;
        let bestCpk = 0;
        let bestDiff = Infinity;
        let foundTarget = false;

        for (let attempt = 0; attempt < maxAttempts && !stopGenerationFlag; attempt++) {
            updateProgress(30 + (attempt * 40 / maxAttempts));

            let values;
            if (forceRange) {
                values = generateRestrictedMode(sampleSize, currentMean, currentSigma, minVal, maxVal, decimals);
            } else {
                values = generateFreeMode(sampleSize, currentMean, currentSigma, minVal, maxVal, lsl, usl, targetCpk, decimals);
            }

            const currentCpk = calculateCpk(values, lsl, usl, subgroupSize);
            const currentDiff = Math.abs(currentCpk - targetCpk);

            if (currentDiff < bestDiff) {
                bestDiff = currentDiff;
                bestCpk = currentCpk;
                bestValues = [...values];
            }

            if (currentDiff <= tolerance) {
                foundTarget = true;
                statusDisplay.textContent = `${modeText}\n✅ Target Cpk achieved after ${attempt + 1} attempts\nCurrent Cpk: ${currentCpk.toFixed(3)} (Target: ${targetCpk})`;
                break;
            }

            if (autoAdjust) {
                if (currentCpk < targetCpk) {
                    currentSigma *= adjFactor;
                } else {
                    currentSigma *= (2 - adjFactor);
                }

                if (forceRange) {
                    const maxSigma = (maxVal - minVal) / 6;
                    currentSigma = Math.min(currentSigma, maxSigma);
                }

                currentSigma = Math.max(currentSigma, rangeWidth * 0.01);
            }

            if (attempt % 10 === 0) {
                statusDisplay.textContent = `${modeText}\nAttempt ${attempt + 1}/${maxAttempts}\nCurrent Cpk: ${currentCpk.toFixed(3)} (Target: ${targetCpk})\nBest Cpk: ${bestCpk.toFixed(3)}, Diff: ${bestDiff.toFixed(3)}`;
                await delay(10);
            }
        }

        if (stopGenerationFlag) {
            statusDisplay.textContent = "Generation stopped by user.";
            updateProgress(0);
            return;
        }

        generatedValues = bestValues || [];

        if (generatedValues.length === 0) {
            alert("Could not generate values. Please check your parameters.");
            return;
        }

        updateProgress(80);
        calculateAndDisplayStatistics(generatedValues, lsl, usl, targetCpk, subgroupSize, decimals);
        updateValuesTable(generatedValues, decimals);
        updateHistogram(generatedValues, lsl, usl, decimals, minVal, maxVal, forceRange);

        const valuesStr = generatedValues.map(v => formatNumber(v, decimals)).join('\n');
        copyToClipboard(valuesStr);

        updateProgress(100);

        const meanVal = generatedValues.reduce((a, b) => a + b, 0) / generatedValues.length;
        const [_, stdWithin] = calculateBothStandardDeviations(generatedValues, subgroupSize);

        let finalCpk;
        if (specType === 'bilateral' && stdWithin > 0) {
            const cpu = (usl - meanVal) / (3 * stdWithin);
            const cpl = (meanVal - lsl) / (3 * stdWithin);
            finalCpk = Math.min(cpu, cpl);
        } else if (specType === 'unilateral_lsl' && stdWithin > 0) {
            finalCpk = (meanVal - lsl) / (3 * stdWithin);
        } else if (specType === 'unilateral_usl' && stdWithin > 0) {
            finalCpk = (usl - meanVal) / (3 * stdWithin);
        } else {
            finalCpk = Infinity;
        }

        const finalMin = Math.min(...generatedValues);
        const finalMax = Math.max(...generatedValues);

        let statusMsg = `✅ Generated ${sampleSize} values`;
        if (forceRange) {
            if (finalMin >= minVal && finalMax <= maxVal) {
                statusMsg += " (all in range)";
            } else {
                statusMsg += " ⚠️ (some outside range - clipping applied)";
            }
        } else {
            const outOfRange = generatedValues.filter(v => v < minVal || v > maxVal).length;
            if (outOfRange > 0) {
                statusMsg += ` (${outOfRange} values outside range)`;
            }
        }

        if (foundTarget) {
            statusMsg += ` | ✅ Target Cpk achieved: ${finalCpk.toFixed(3)}`;
        } else {
            statusMsg += ` | Best Cpk: ${finalCpk.toFixed(3)} (Target: ${targetCpk}, Diff: ${Math.abs(finalCpk - targetCpk).toFixed(3)})`;
        }

        statusDisplay.textContent = `✅ Generation complete!\n${statusMsg}\nMean: ${formatNumber(meanVal, decimals + 1)} | Sigma: ${formatNumber(currentSigma, decimals + 3)}`;

    } catch (error) {
        console.error('Generation error:', error);
        alert(`Generation failed: ${error.message}`);
        document.getElementById('statusDisplay').textContent = `Error: ${error.message}`;
    } finally {
        setButtonState('generateBtn', false);
        setButtonState('stopBtn', true);
        updateProgress(0);
    }
}

function stopGeneration() {
    stopGenerationFlag = true;
    const statusDisplay = document.getElementById('statusDisplay');
    if (statusDisplay) {
        statusDisplay.textContent = "Stopping generation process...";
    }
}

function generateRestrictedMode(n, mean, sigma, minVal, maxVal, decimals) {
    const oversample = Math.floor(n * 1.5);
    const values = [];

    for (let i = 0; i < oversample; i++) {
        const value = normalRandom(mean, sigma);
        values.push(Math.max(minVal, Math.min(maxVal, value)));
    }

    if (values.length >= n) {
        return values.slice(0, n).map(v => parseFloat(v.toFixed(decimals)));
    } else {
        const needed = n - values.length;
        for (let i = 0; i < needed; i++) {
            values.push(minVal + Math.random() * (maxVal - minVal));
        }
        return values.map(v => parseFloat(v.toFixed(decimals)));
    }
}

function generateFreeMode(n, mean, sigma, minVal, maxVal, lsl, usl, targetCpk, decimals) {
    const specType = getInputValue('specType');

    if (specType === 'bilateral') {
        const specRange = usl - lsl;
        const targetSigma = specRange / (6 * targetCpk);
        sigma = (sigma + targetSigma) / 2;
    }

    const values = [];
    for (let i = 0; i < n; i++) {
        values.push(normalRandom(mean, sigma));
    }

    return values.map(v => parseFloat(v.toFixed(decimals)));
}

function normalRandom(mean = 0, sigma = 1) {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return mean + sigma * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}