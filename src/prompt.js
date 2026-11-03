const readline = require('readline');

/**
 * Creates a standard input/output readline interface.
 * @returns {readline.Interface}
 */
function createCliInterface() {
    return readline.createInterface({ input: process.stdin, output: process.stdout });
}

/**
 * Prompts a question to the user.
 * @param {readline.Interface} readlineInterface - Readline instance.
 * @param {string} questionText - Question string.
 * @returns {Promise<string>} User input response.
 */
function askQuestion(readlineInterface, questionText) {
    return new Promise(resolve => readlineInterface.question(questionText, resolve));
}

/**
 * Prompts the user for a valid numeric choice within a range.
 * @param {readline.Interface} readlineInterface - Readline instance.
 * @param {string} questionText - Question string.
 * @param {number} maxAllowedValue - Maximum valid number.
 * @returns {Promise<number>} Validated integer choice.
 */
async function promptNumericChoice(readlineInterface, questionText, maxAllowedValue) {
    while (true) {
        const rawInput = await askQuestion(readlineInterface, questionText);
        const parsedNumber = parseInt(rawInput.trim(), 10);
        if (!isNaN(parsedNumber) && parsedNumber >= 0 && parsedNumber <= maxAllowedValue) {
            return parsedNumber;
        }
        console.log(`[ERROR] Please enter a valid number between 0 and ${maxAllowedValue}.`);
    }
}

/**
 * Prompts a Yes/No confirmation question.
 * @param {readline.Interface} readlineInterface - Readline instance.
 * @param {string} questionText - Question string.
 * @returns {Promise<boolean>} True if user answers 'y', false for 'n'.
 */
async function promptYesNoConfirmation(readlineInterface, questionText) {
    while (true) {
        const rawInput = await askQuestion(readlineInterface, `${questionText} (y/n): `);
        const normalizedAnswer = rawInput.trim().toLowerCase();
        if (normalizedAnswer === 'y') return true;
        if (normalizedAnswer === 'n') return false;
        console.log("[ERROR] Please enter 'y' or 'n'.");
    }
}

module.exports = { createCliInterface, promptNumericChoice, promptYesNoConfirmation };