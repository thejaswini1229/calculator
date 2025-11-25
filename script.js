// script.js
// Safe calculator logic: tokenize -> shunting-yard -> RPN eval
// Handles decimals, unary minus, parentheses, divide-by-zero, keyboard support.

// DOM refs
const displayEl = document.getElementById('display');
const historyEl = document.getElementById('history');
const buttons = document.querySelectorAll('button.btn');

let expression = ''; // human-readable internal expression (uses /, *, +, -, parentheses, decimals)
let lastResult = null;

const isOperator = (t) => ['+','-','*','/'].includes(t);
const precedence = (op) => ({'+':1,'-':1,'*':2,'/':2})[op] || 0;

function updateDisplays(){
  displayEl.textContent = expression === '' ? '0' : expression;
  historyEl.textContent = lastResult === null ? '' : 'Ans = ' + lastResult;
}

// Append digits or '.' with safety rules
function pushValue(val){
  if(val === '.'){
    // inspect current last number token to prevent multiple dots
    const tokens = tokenize(expression);
    const last = tokens.length ? tokens[tokens.length - 1] : null;
    if(last && /^-?\d+(?:\.\d*)?$/.test(last)){
      // if last already has a dot, ignore
      if(last.includes('.')) return;
      expression += '.';
    } else {
      // start a new "0."
      expression += '0.';
    }
    updateDisplays();
    return;
  }

  // digit
  expression += val;
  updateDisplays();
}

function clearAll(){ expression = ''; lastResult = null; updateDisplays(); }
function backspace(){ expression = expression.slice(0, -1); updateDisplays(); }

// Tokenizer: returns array of tokens (numbers, operators, parentheses)
// Ensures numbers ending with '.' are normalized to have a trailing 0 (e.g., '12.' -> '12.0')
// Prevents multiple dots in a single number token.
function tokenize(str){
  if(!str) return [];
  const tokens = [];
  let i = 0;
  while(i < str.length){
    const ch = str[i];
    if(ch === ' ') { i++; continue; }

    // number (digit or dot start)
    if(/[0-9.]/.test(ch)){
      let num = '';
      let dotCount = 0;
      while(i < str.length && /[0-9.]/.test(str[i])){
        if(str[i] === '.'){
          dotCount++;
          if(dotCount > 1) break; // stop at second dot (will leave extra chars for later handling)
        }
        num += str[i];
        i++;
      }
      // normalize a trailing dot
      if(num.endsWith('.')) num += '0';
      tokens.push(num);
      continue;
    }

    // operator or parenthesis
    if(isOperator(ch) || ch === '(' || ch === ')'){
      // unary minus handling: if '-' appears and previous token is null or operator or '('
      if(ch === '-'){
        const prev = tokens.length ? tokens[tokens.length - 1] : null;
        if(prev === null || isOperator(prev) || prev === '('){
          // treat unary minus as '0' '-' so later number becomes negative correctly
          tokens.push('0');
        }
      }
      tokens.push(ch);
      i++;
      continue;
    }

    // unknown char - skip it
    i++;
  }
  return tokens;
}

// Convert tokens to RPN using shunting-yard
function toRPN(tokens){
  const out = [];
  const ops = [];
  for(const tok of tokens){
    if(/^-?\d+(?:\.\d+)?$/.test(tok)){ // integer or decimal (allow leading negative via unary handling)
      out.push(tok);
    } else if(isOperator(tok)){
      while(ops.length && isOperator(ops[ops.length - 1]) && precedence(ops[ops.length - 1]) >= precedence(tok)){
        out.push(ops.pop());
      }
      ops.push(tok);
    } else if(tok === '('){
      ops.push(tok);
    } else if(tok === ')'){
      while(ops.length && ops[ops.length - 1] !== '('){
        out.push(ops.pop());
      }
      if(ops.length && ops[ops.length - 1] === '(') ops.pop();
      else throw new Error('Mismatched parentheses');
    } else {
      throw new Error('Invalid token: ' + tok);
    }
  }
  while(ops.length){
    const op = ops.pop();
    if(op === '(' || op === ')') throw new Error('Mismatched parentheses');
    out.push(op);
  }
  return out;
}

// Evaluate RPN
function evalRPN(rpn){
  const st = [];
  for(const tok of rpn){
    if(/^-?\d+(?:\.\d+)?$/.test(tok)){
      st.push(parseFloat(tok));
    } else if(isOperator(tok)){
      if(st.length < 2) throw new Error('Invalid expression');
      const b = st.pop();
      const a = st.pop();
      let res;
      if(tok === '+') res = a + b;
      else if(tok === '-') res = a - b;
      else if(tok === '*') res = a * b;
      else if(tok === '/'){
        if(b === 0) throw new Error('DivideByZero');
        res = a / b;
      }
      st.push(res);
    } else {
      throw new Error('Invalid RPN token ' + tok);
    }
  }
  if(st.length !== 1) throw new Error('Invalid expression');
  return st[0];
}

function computeExpression(expr){
  const tokens = tokenize(expr);
  if(tokens.length === 0) return 0;
  const rpn = toRPN(tokens);
  return evalRPN(rpn);
}

// Button events
buttons.forEach(btn => btn.addEventListener('click', () => {
  const v = btn.getAttribute('data-value');
  const action = btn.getAttribute('data-action');

  if(action === 'clear'){ clearAll(); return; }
  if(action === 'back'){ backspace(); return; }
  if(action === 'eval'){ evaluateNow(); return; }

  if(v){
    // If v is operator
    if(isOperator(v)){
      const tokens = tokenize(expression);
      const last = tokens.length ? tokens[tokens.length - 1] : null;
      if(last === null){
        // allow unary minus only
        if(v === '-') expression += v;
        // otherwise ignore leading +*/.
      } else if(isOperator(last)){
        // replace last operator with new one
        expression = expression.slice(0, -1) + v;
      } else {
        expression += v;
      }
      updateDisplays();
      return;
    }

    // parentheses
    if(v === '(' || v === ')'){
      expression += v;
      updateDisplays();
      return;
    }

    // digits or dot
    pushValue(v);
  }
}));

function evaluateNow(){
  try{
    const result = computeExpression(expression || '0');
    if(!isFinite(result)) throw new Error('DivideByZero');
    // round to 9 decimal places max to keep display neat
    const rounded = Math.round((result + Number.EPSILON) * 1e9) / 1e9;
    lastResult = rounded;
    expression = String(rounded);
    updateDisplays();
  } catch(err){
    if(err.message === 'DivideByZero'){
      displayEl.textContent = 'Error: Divide by zero';
    } else {
      displayEl.textContent = 'Error';
    }
    historyEl.textContent = '';
    expression = '';
    lastResult = null;
    // restore normal display after a short pause
    setTimeout(updateDisplays, 1100);
  }
}

// Keyboard support
window.addEventListener('keydown', (ev) => {
  const key = ev.key;
  if(/^[0-9]$/.test(key)){ pushValue(key); ev.preventDefault(); return; }
  if(key === '.') { pushValue('.'); ev.preventDefault(); return; }
  if(['+','-','*','/','(',')'].includes(key)){ expression += key; updateDisplays(); ev.preventDefault(); return; }
  if(key === 'Backspace'){ backspace(); ev.preventDefault(); return; }
  if(key === 'Enter' || key === '='){ evaluateNow(); ev.preventDefault(); return; }
  if(key === 'Escape'){ clearAll(); ev.preventDefault(); return; }
});

// initialize UI
updateDisplays();
