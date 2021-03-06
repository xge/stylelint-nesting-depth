const stylelint = require('stylelint')
const parser = require("postcss-selector-parser")
const isStandardSyntaxRule = require('stylelint/lib/utils/isStandardSyntaxRule')
const ruleName = 'plugin/report-nesting-depth'
const messages =  stylelint.utils.ruleMessages(ruleName, {
  report: 'Generated report. node = map with depths per selector'
})
const isIgnoreAtRule = node => 
    node.type === "atrule"
const hasBlock = statement =>
    statement.nodes !== undefined
const resolvedNestedSelector = require("postcss-resolve-nested-selector")

module.exports = stylelint.createPlugin(
  ruleName, 
  (actual) => (postcssRoot, postcssResult) => {
    const validOptions = stylelint.utils.validateOptions(postcssResult, ruleName, { actual });
    let nestingDepthMap = []

    if (!validOptions) return;

    postcssRoot.walkRules(checkStatement);
    postcssRoot.walkAtRules(checkStatement);

    stylelint.utils.report({
      ruleName,
      result: postcssResult,
      node: nestingDepthMap,
      message: messages.report,
      line: 1
    });

    function checkStatement(statement) {
      if (isIgnoreAtRule(statement)) {
        return;
      }

      if (!hasBlock(statement)) {
        return;
      }

      if (statement.selector && !isStandardSyntaxRule(statement)) {
        return;
      }

      const ro = nestingDepth(statement);

      if(ro) {
        const resolvedSelector = resolvedNestedSelector(ro.origin.selector, ro.origin)[0]
        nestingDepthMap.push({ selector: resolvedSelector, depth: ro.level})
      }
    }

    function nestingDepth(node, level, originNode) {
      level = level || 0;
      originNode = originNode || node
      const parent = node.parent;

      if (isIgnoreAtRule(parent)) {
        return null;
      }
      if (
        parent.type === "root" ||
        (parent.type === "atrule" && parent.parent.type === "root")
      ) {
        return {level: level, origin: originNode};
      }

      function containsPseudoClassesOnly(selector) {
        const normalized = parser().processSync(selector, { lossless: false });
        const selectors = normalized.split(",");

        return selectors.every(
          selector => selector.startsWith("&:") && selector[2] !== ":"
        );
      }

      if (
        (node.type === "atrule" &&
          node.every(child => child.type !== "decl")) ||
        (node.type === "rule" &&
          containsPseudoClassesOnly(node.selector))
      ) {
        return nestingDepth(parent, level, originNode);
      }
      return nestingDepth(parent, level + 1, originNode);
    }
  }
)

module.exports.ruleName = ruleName
module.exports.messages = messages