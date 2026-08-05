# WSLR Functions & Events — Quote System

A clickable prototype of a quoting system for **Wollongong Surf Leisure Resort**, built to sit on the same Google Sheets + Apps Script stack as the existing booking-confirmation builder.

**Everything in it is made-up sample data.** Nothing is saved, nothing is sent, and it is not connected to any real inbox. Refreshing the page resets it.

## How to view it

- **Online:** <https://gjoel.github.io/wslr-quote-system/>
- **Offline:** download `index.html` and double-click it — it is fully self-contained and works without internet.

## What to try

1. **Tab 1 — Build a quote:** change a price (note the "adjusted · reset" tag), add a custom line with its own unit type, put a day & time on a meal.
2. **Tab 2 — What the client sees:** the live client quote page. Click **Accept this quote**, or **Download PDF** (`WSLR_sample_quote.pdf` in this repo shows the output).
3. **Tab 3 — Pipeline at a glance:** every quote on one page, with follow-ups that can't be forgotten.

## The point

- Prices pull from a rate card **you** own and can override on any quote.
- Nothing ever sends itself — a person always checks and presses send.
- Every quote logs itself, so the pipeline is visible even in a busy week or when someone's on leave.
