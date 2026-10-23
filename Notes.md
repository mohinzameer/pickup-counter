# AI Usage Notes

I used AI tools to scaffold the project, generate boilerplate, and assist with the reasoning behind the complex concurrency and security edge cases.

## Tools used
- **DeepSeek (via web interface):** Used for generating the base NestJS application structure, drafting the TypeORM entities/migrations, designing the React components, and walking through the exact transaction logic needed for safe concurrent updates.
- **GitHub Copilot (VS Code extension):** Used for inline autocomplete (primarily repetitive DTO definitions, Tailwind CSS utility classes, and writing the `send-webhook.ts` script).

## One prompt that worked well
> "Write a TypeORM transaction for creating an order that locks product rows using `FOR UPDATE` in sorted order to prevent deadlocks. Recalculate the held quantity inside the transaction to ensure we never oversell. If any item is out of stock, throw a 409 and roll back everything."

**Why it worked:** Being extremely specific about the concurrency requirements (locking, sorting for deadlocks, recalculating inside the transaction) forced DeepSeek to generate the exact TypeORM `pessimistic_write` syntax and the necessary transaction wrapper. It immediately produced code that passed the "ten customers, two units" test without needing major structural changes.

## Specific things the AI got wrong (and how I caught them)

**1. The Stock Decrement Bug**
- **The Bug:** The AI initially wrote the stock decrement logic inside the pickup-claim service using TypeORM's `.update()` method, passing the quantity as a parameter:
  ```typescript
  // Initial AI output (WRONG):
  .update(Product, { stock_units: -quantity })