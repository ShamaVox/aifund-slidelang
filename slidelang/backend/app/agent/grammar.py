GRAMMAR = """SlideLang grammar (output ONLY this, no prose, no backticks):

deck "<title>"
theme <midnight|paper|sunrise|forest>

dataset <name>
  row <Label> <number>

slide title
  heading "<text>"
  subtitle "<text>"
slide bullets
  heading "<text>"
  point "<text>"                 (2-6 points)
slide metrics
  heading "<text>"
  metric "<label>" "<value>" "<delta>"    (up to 4)
slide chart.bar | chart.line | chart.area | chart.pie
  heading "<text>"
  data Label 120, Label2 90        (numeric) OR  bind <dataset>
slide table
  heading "<text>"
  cols "A" "B"
  row "a" "b"
slide math
  heading "<text>"
  formula "LTV = ARPU \\\\times \\\\frac{1}{churn}"
slide quote
  quote "<text>"
  cite "<who>"

Any slide may add:  notes "<speaker notes>"
Rules: indent 2 spaces. Headings < 58 chars. 6-8 slides. Numeric chart values only."""
