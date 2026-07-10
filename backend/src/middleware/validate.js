import { ApiError } from '../utils/ApiError.js';

// Validates req.body / req.query / req.params against zod schemas.
// Parsed values replace the originals so handlers get coerced types.
export function validate(schemas) {
  return (req, res, next) => {
    for (const key of ['body', 'query', 'params']) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        const details = result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        return next(new ApiError(400, 'Validation failed', details));
      }
      if (key === 'query') {
        // Express 5 makes req.query a getter; mutate instead of reassign
        req.validatedQuery = result.data;
      } else {
        req[key] = result.data;
      }
    }
    next();
  };
}
