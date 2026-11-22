(comment) @comment
(preprocessor_directive) @preproc
["proctype" "init" "active" "if" "fi" "do" "od" "goto" "run"
 "atomic" "d_step" "ltl" "never" "typedef" "else" "assert"
 "unless" "provided" "priority"] @keyword
; The break rule is a named (break) node; it is not an anonymous "break" token.
(break) @keyword
(type) @type
(number) @number
(string) @string
(labeled_step name: (uname) @label)
(proc (uname) @function)

(unsigned_decl) @type
(unsigned_item name: (uname) @variable)
