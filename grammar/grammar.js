// ProMeLa Tree-sitter grammar, maintained in this repository.
// Based on siraben/tree-sitter-promela, commit 91da8f141c3c4c695eb71018c8a7b2e7ea39c167 (MIT).
// This is a self-contained source file, not an overlay on an external checkout.
// Syntax compatibility is deliberately limited; see docs/COMPATIBILITY.md.
module.exports = grammar({
  name: 'promela',
  // EXPERIMENT: keyword extraction may improve error recovery after junk.
  // Verify with the dedicated regression test before merging this change.
  word: $ => $.uname,
  // Keep raw preprocessor directives in the source tree without pretending to expand them.
  // This is a syntactic source view, not SPIN's preprocessed translation unit.
  extras: $ => [/\s/, $.comment, $.preprocessor_directive],
  // Parenthesized LTL and ordinary expressions overlap. Keep both parse
  // interpretations, but expose LTL formulas only in ltl_body. This avoids
  // treating `:: guard -> assignment` as an LTL implication.
  // The `uname ':'` prefix is shared by remote references and statement
  // labels.  Preserving all three interpretations is necessary because
  // static precedence alone cannot resolve the LR(1) conflict.  Tree-sitter
  // chooses the best full parse after the following tokens have been read.
  conflicts: $ => [
    [$.sequence],
    [$.ltl_expr, $.expr],
    [$.labeled_step, $.pfld, $.expr],
  ],
  rules: {
    // Tree-sitter uses the FIRST rule as the start symbol. Keep 'program'
    // first; putting preprocessor_directive here silently breaks all .pml files.
    program: $ => repeat($._unit),
    // Named extra: source-level directive only; does not expand or evaluate CPP.
    // Continuation lines and CPP evaluation are handled by a separate layer.
    preprocessor_directive: $ => token(/#[^\r\n]*/),
    _unit: $ => choice($.proc, $.init, $.claim, $.ltl, $.events,
      $.one_decl, $.utype, $.inline_definition, $._semi),
    priority: $ => seq('priority', $.const),
    init: $ => seq('init', optional($.priority), $.body),
    ltl: $ => seq('ltl', optional($.uname), $.ltl_body),
    claim: $ => seq('never', optional($.uname), $.body),
    events: $ => seq(choice('trace', 'notrace'), $.body),
    utype: $ => seq('typedef', $.uname, '{', sep1($.one_decl, $._semi), '}'),
    // Inline fragments are statement macros, not processes. The names and
    // formal arguments are explicit nodes for symbol navigation.
    inline_definition: $ => seq(
      'inline', field('name', $.uname),
      '(', optional($.inline_parameters), ')',
      field('body', $.body),
    ),
    inline_parameters: $ => commaSep1($.uname),
    inline_call: $ => prec(19, seq(
      field('name', $.uname), '(', optional($.arg), ')',
    )),
    ltl_body: $ => seq('{', $.ltl_expr, optional($._semi), '}'),
    _semi: $ => choice(';', $._arrow),
    _arrow: $ => '->',
    proc: $ => seq(optional($.inst), 'proctype', $.uname, '(', optional($.decl), ')',
      optional($.priority), optional($.enabler), $.body),
    inst: $ => choice('active', seq('active', '[', $.const_expr, ']'),
      seq('active', '[', $.uname, ']')),
    body: $ => seq('{', $.sequence, optional($._ms), '}'),
    sequence: $ => sep1($.step, $._ms),
    arg: $ => choice($.expr, seq($.expr, ',', $.arg)),
    margs: $ => choice($.arg, seq($.expr, '(', $.arg, ')')),
    _ms: $ => repeat1($._semi),
    decl: $ => sep1($.one_decl, $._semi),
    xu: $ => choice('xr', 'xs'),
    vref_lst: $ => commaSep1($.varref),
    step: $ => choice(
      $.labeled_step,
      $.one_decl,
      seq($.xu, $.vref_lst),
      $._stmnt,
      seq($._stmnt, 'unless', $._stmnt),
    ),
    // Keep labels as a named node for `goto`. The leading `uname:` also
    // starts a remote reference (`uname : pfld`) in an expression, so the
    // conflict declaration above preserves both interpretations. Prefer the
    // completed labeled-statement parse in a statement context, but allow
    // expressions like `assert(Observer:state)` to remain remote references.
    labeled_step: $ => prec.dynamic(2, prec.right(20, seq(
      field('name', $.uname), ':', field('statement', $._stmnt),
    ))),
    _stmnt: $ => choice($.Special, $.Stmnt),
    Stmnt: $ => choice(
      $.assignment,
      prec.left(16, seq($.varref, '++')),
      prec.left(16, seq($.varref, '--')),
      seq('set_priority', '(', $.two_args, ')'),
      $.printf,
      $.inline_call,
      seq('assert', $.full_expr),
      seq($.varref, '??', $.rargs),
      seq($.varref, '?', '<', $.rargs, '>'),
      seq($.varref, '??', '<', $.rargs, '>'),
      $.full_expr,
      'else',
      seq('atomic', '{', $.sequence, optional($._semi), '}'),
      seq('d_step', '{', $.sequence, optional($._semi), '}'),
      seq('{', $.sequence, optional($._semi), '}'),
      seq($.varref, $._asgn, $.iname, '(', optional($.arg), ')', $.Stmnt),
      seq('return', $.full_expr),
    ),
    iname: $ => $.uname,
    assignment: $ => seq($.varref, $._asgn, $.full_expr),
    printf: $ => seq('printf', '(', $.string, optional(seq(',', $.arg)), ')'),
    string: $ => seq('"', /(?:[^"\\]|\\.)*/, '"'),
    Special: $ => choice(
      $.rcv, $.snd,
      seq($.for_pre, ':', $.expr, '..', $.expr, ')', $.for_post),
      seq($.for_pre, 'in', $.varref, ')', $.for_post),
      seq('select', '(', $.varref, ':', $.expr, '..', $.expr, ')'),
      $.if, $.do, $.break, $.goto,
    ),
    rcv: $ => seq($.varref, '?', $.rargs),
    snd: $ => seq($.varref, '!', $.margs),
    break: $ => 'break',
    goto: $ => seq('goto', $.uname),
    rarg: $ => choice($.varref, seq('eval', '(', $.expr, ')'), $.const, seq('-', $.const)),
    rargs: $ => prec.left(1, choice(
      $.rarg,
      seq($.rarg, ',', $.rargs),
      seq($.rarg, '(', $.rargs, ')'),
      seq('(', $.rargs, ')'),
    )),
    if: $ => seq('if', $.options, 'fi'),
    do: $ => seq('do', $.options, 'od'),
    for_pre: $ => seq('for', '(', $.varref),
    for_post: $ => choice(
      seq('{', $.sequence, optional($._semi), '}'),
      seq($._semi, '{', $.sequence, optional($._semi), '}'),
    ),
    options: $ => repeat1($.option),
    option: $ => seq('::', $.sequence, optional($._semi)),
    vis: $ => choice('hidden', 'show', 'islocal'),
    osubt: $ => seq(':', $.uname),
    uname: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    one_decl: $ => choice(
      $.unsigned_decl,
      seq(optional($.vis), $.type, optional($.osubt), $.var_list),
      seq(optional($.vis), alias($.uname, 'type'), $.var_list),
      seq(optional($.vis), $.type, optional($._asgn), '{', $.nlst, '}'),
    ),
    // SPIN unsigned variables require an explicit bit width: unsigned n : 5 = 15;
    unsigned_decl: $ => seq(optional($.vis), 'unsigned', commaSep1($.unsigned_item)),
    unsigned_item: $ => seq(
      field('name', $.uname), ':', field('bits', $.const_expr),
      optional(seq('=', $.expr)),
    ),
    nlst: $ => sep1($.uname, optional(',')),
    _asgn: $ => choice(seq(':', $.uname, '='), '='),
    full_expr: $ => choice($.expr, $.Expr),
    // LTL syntax is *only* reachable from ltl_body.
    ltl_expr: $ => choice(
      $.expr,
      seq('(', $.ltl_expr, ')'),
      prec.right(7, seq('X', $.ltl_expr)),
      prec.right(7, seq('[]', $.ltl_expr)),
      prec.right(7, seq('<>', $.ltl_expr)),
      prec.left(6, seq($.ltl_expr, 'U', $.ltl_expr)),
      prec.left(6, seq($.ltl_expr, 'V', $.ltl_expr)),
      prec.left(6, seq($.ltl_expr, 'W', $.ltl_expr)),
      prec.left(4, seq($.ltl_expr, '&&', $.ltl_expr)),
      prec.left(3, seq($.ltl_expr, '||', $.ltl_expr)),
      prec.left(2, seq($.ltl_expr, '->', $.ltl_expr)),
      prec.left(2, seq($.ltl_expr, '<->', $.ltl_expr)),
    ),
    varref: $ => $.cmpnd,
    cmpnd: $ => prec.left(18, sep1($.pfld, '.')),
    pfld: $ => prec.left(10, choice($.uname, seq($.uname, '[', $.expr, ']'))),
    type: $ => choice('bit', 'bool', 'byte', 'chan', 'int', 'mtype', 'pid', 'short'),
    var_list: $ => commaSep1($.ivar),
    const: $ => choice('false', 'true', $.skip, $.number),
    skip: $ => 'skip',
    vardcl: $ => choice(
      $.uname,
      seq($.uname, ':', $.const),
      seq($.uname, '[', $.const_expr, ']'),
      seq($.uname, '[', $.uname, ']'),
    ),
    const_expr: $ => choice(
      $.const,
      prec.right(17, seq('-', $.const_expr)),
      seq('(', $.const_expr, ')'),
      prec.left(14, seq($.const_expr, '+', $.const_expr)),
      prec.left(14, seq($.const_expr, '-', $.const_expr)),
      prec.left(15, seq($.const_expr, '*', $.const_expr)),
      prec.left(15, seq($.const_expr, '/', $.const_expr)),
      prec.left(15, seq($.const_expr, '%', $.const_expr)),
    ),
    c_list: $ => commaSep1($.const),
    ivar: $ => choice(
      $.vardcl,
      seq($.vardcl, '=', '{', $.c_list, '}'),
      seq($.vardcl, '=', $.expr),
      seq($.vardcl, '=', $.ch_init),
    ),
    ch_init: $ => seq('[', $.const_expr, ']', 'of', '{', $.typ_list, '}'),
    enabler: $ => seq('provided', '(', $.full_expr, ')'),
    oname: $ => seq(':', $.uname),
    basetype: $ => choice(seq($.type, optional($.oname)), $.uname),
    typ_list: $ => commaSep1($.basetype),
    two_args: $ => seq($.expr, ',', $.expr),
    aname: $ => $.uname,
    expr: $ => choice(
      seq('(', $.expr, ')'),
      prec.left(14, seq($.expr, '+', $.expr)),
      prec.left(14, seq($.expr, '-', $.expr)),
      prec.left(15, seq($.expr, '*', $.expr)),
      prec.left(15, seq($.expr, '/', $.expr)),
      prec.left(15, seq($.expr, '%', $.expr)),
      prec.left(10, seq($.expr, '&', $.expr)),
      prec.left(9, seq($.expr, '^', $.expr)),
      prec.left(8, seq($.expr, '|', $.expr)),
      prec.left(12, seq($.expr, '>', $.expr)),
      prec.left(12, seq($.expr, '<', $.expr)),
      prec.left(12, seq($.expr, '>=', $.expr)),
      prec.left(12, seq($.expr, '<=', $.expr)),
      prec.left(11, seq($.expr, '==', $.expr)),
      prec.left(11, seq($.expr, '!=', $.expr)),
      prec.left(4, seq($.expr, '&&', $.expr)),
      prec.left(3, seq($.expr, '||', $.expr)),
      prec.left(13, seq($.expr, '<<', $.expr)),
      prec.left(13, seq($.expr, '>>', $.expr)),
      prec.right(17, seq('~', $.expr)),
      prec.right(17, seq('-', $.expr)),
      prec.right(17, seq('!', $.expr)),
      seq('(', $.expr, '->', $.expr, ':', $.expr, ')'),
      seq('run', $.aname, '(', optional($.arg), ')', optional($.priority)),
      seq('len', '(', $.varref, ')'),
      seq('enabled', '(', $.expr, ')'),
      seq('get_priority', '(', $.expr, ')'),
      seq($.varref, '?', '[', $.rargs, ']'),
      seq($.varref, '??', '[', $.rargs, ']'),
      $.varref,
      $.const,
      'timeout',
      'np_',
      seq('pc_value', '(', $.expr, ')'),
      seq($.uname, '[', $.expr, ']', '@', $.uname),
      seq($.uname, '[', $.expr, ']', '@', $.pfld),
      seq($.uname, '@', $.uname),
      seq($.uname, ':', $.pfld),
    ),
    Expr: $ => choice(
      $.Probe,
      seq('(', $.Expr, ')'),
      prec.left(4, seq($.Expr, '&&', $.Expr)),
      prec.left(4, seq($.Expr, '&&', $.expr)),
      prec.left(4, seq($.expr, '&&', $.Expr)),
      prec.left(3, seq($.Expr, '||', $.Expr)),
      prec.left(3, seq($.Expr, '||', $.expr)),
      prec.left(3, seq($.expr, '||', $.Expr)),
    ),
    Probe: $ => choice(
      seq('full', '(', $.varref, ')'),
      seq('nfull', '(', $.varref, ')'),
      seq('empty', '(', $.varref, ')'),
      seq('nempty', '(', $.varref, ')'),
    ),
    number: $ => /\d+/,
    comment: $ => token(choice(
      seq('//', /.*/),
      seq('/*', repeat(choice(/[^*]/, /\*[^/]/)), '*/'),
    )),
  },
});

function sep1(rule, separator) { return seq(rule, repeat(seq(separator, rule))); }
function commaSep1(rule) { return sep1(rule, ','); }
