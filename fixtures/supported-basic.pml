mtype = { request, response };
typedef Packet {
    int number;
    byte payload
};
chan queue = [2] of { mtype, int };
int globalCount;

active proctype Worker(byte input) {
    byte local;
    local = input;
    if
    :: local > 0; globalCount = globalCount + 1;
    :: else -> skip;
    fi;
    queue ! request, local;
}

init {
    run Worker(2);
}
ltl eventuallyPositive { <> (globalCount > 0) }
