// Translates Run Code HTTP requests to CodeService calls.
// Thin controller: no Docker — execution runs on the judge worker via the queue.

const { codeService } = require('./code.service');
const { sendSuccess } = require('../../shared/http/response');

async function runCode(req, res, next) {
  try {
    const result = await codeService.runCode({
      problemId: req.body.problemId,
      language: req.body.language,
      sourceCode: req.body.sourceCode,
      customInput: req.body.customInput,
      requestId: req.requestId || req.correlationId,
    });
    sendSuccess(req, res, 200, result);
  } catch (err) {
    next(err);
  }
}

module.exports = { runCode };
