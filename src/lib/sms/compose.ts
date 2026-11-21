import { renderTemplate } from "./template";

/** Pure: choose the template (month-specific, else default) and render the final text. */
export function composeAck(args: {
  monthTemplate?: string | null; defaultTemplate: string; churchName: string; currency: string;
  fullName: string; amount: number; paymentDate: string; totalThisMonth: number;
}): { text: string; usedDefault: boolean } {
  const body = args.monthTemplate?.trim() ? args.monthTemplate : args.defaultTemplate;
  return {
    usedDefault: !args.monthTemplate?.trim(),
    text: renderTemplate(body, { fullName: args.fullName, amount: args.amount, totalThisMonth: args.totalThisMonth, currency: args.currency, paymentDate: args.paymentDate, churchName: args.churchName }),
  };
}
