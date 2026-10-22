/**
 * Validate experiment result objects against experiment/result.schema.json (M6 #60).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'experiment/result.schema.json');

let compiledValidator;

export function getResultSchemaValidator() {
  if (!compiledValidator) {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    compiledValidator = ajv.compile(schema);
  }
  return compiledValidator;
}

/**
 * @param {object} result
 */
export function validateExperimentResult(result) {
  const validate = getResultSchemaValidator();
  const ok = validate(result);
  return {
    ok: Boolean(ok),
    errors: validate.errors ?? [],
  };
}
