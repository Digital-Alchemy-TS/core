/**
 * Simple branded type
 */
export type TContext = string & IContextBrand;

// Might make the situation more complicated later, it's mostly to keep track of things right now
export interface IContextBrand {
  _context: symbol;
}
