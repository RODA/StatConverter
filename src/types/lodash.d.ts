declare module "lodash" {
  // Minimal typing for orderBy used in the app
  export function orderBy<T>(
    collection: T[] | Record<string, any>,
    iteratees?: Array<((item: T) => any) | string>,
    orders?: Array<"asc" | "desc">,
  ): T[];
}
