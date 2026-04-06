import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { diagnosisHasValidLeadingCie10IfPresent } from './cie10-diagnosis.util';

@ValidatorConstraint({ name: 'isDiagnosisCie10Ok', async: false })
export class IsDiagnosisCie10OkConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, _args: ValidationArguments): boolean {
    if (value === undefined || value === null) {
      return true;
    }
    if (typeof value !== 'string') {
      return false;
    }
    return diagnosisHasValidLeadingCie10IfPresent(value);
  }

  defaultMessage(): string {
    return (
      'If the diagnosis starts with a CIE-10/ICD-10 code, the prefix must be well-formed (e.g. A09 or A09.0).'
    );
  }
}
