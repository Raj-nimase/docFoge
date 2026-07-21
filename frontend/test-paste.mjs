import { normalizeLatexPaste } from "./src/hooks/useMathPaste/mathUtils.js";
import { parseMarkdownMathToHtml, looksLikeMarkdownMath } from "./src/hooks/useMathPaste/markdownParser.js";

const input = `# 1. Introduction

Linear regression models the relationship between variables using a straight-line equation.

For a single predictor:

[
y = \beta_0 + \beta_1x + \varepsilon
]

where:

* (y): dependent variable
* (x): independent variable
* (\beta_0): intercept
* (\beta_1): slope (regression coefficient)
* (\varepsilon): random error

# 3. Model Estimation

The most common estimation method is **Ordinary Least Squares (OLS)**, which minimizes the sum of squared residuals:

[
\min \sum_{i=1}^{n}(y_i-\hat{y}_i)^2
]

Residual:

[
e_i=y_i-\hat{y}_i
]

* **Coefficient of Determination ((R^2))**
* **Adjusted (R^2)** for multiple regression

An (R^2) close to 1 indicates that the model explains a large proportion of the variance.
`;

console.log("looksLikeMarkdownMath:", looksLikeMarkdownMath(input));
const norm = normalizeLatexPaste(input);
console.log("=== NORMALIZED ===");
console.log(norm);
console.log("=== HTML ===");
console.log(parseMarkdownMathToHtml(norm));
