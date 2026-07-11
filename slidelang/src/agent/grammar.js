// The grammar is both documentation and the agent's action-space contract.
export const GRAMMAR = `SlideLang grammar (output ONLY this, no prose, no backticks):

deck "<title>"
theme <midnight|paper|sunrise|forest>

slide title
  heading "<text>"
  subtitle "<text>"

slide section
  heading "<divider text>"

slide bullets
  heading "<text>"
  point "<text>"                 (2-6 points)

slide metrics
  heading "<text>"
  metric "<label>" "<value>" "<delta>"    (up to 4)

slide chart.bar | chart.line | chart.area | chart.pie
  heading "<text>"
  data Label 120, Label2 90, Label3 140   (numeric values only)

slide table
  heading "<text>"
  cols "A" "B" "C"
  row "a1" "b1" "c1"

slide math
  heading "<text>"
  formula "LTV = ARPU \\times \\frac{1}{churn}"

slide quote
  quote "<text>"
  cite "<attribution>"

slide image
  heading "<text>"
  image "<image prompt>"

Any slide may add:  notes "<speaker notes>"

Rules: indent nested lines by exactly 2 spaces. Headings under 58 chars.
Keep bullets <= 6. 6-8 slides. Numeric chart values only.`;
