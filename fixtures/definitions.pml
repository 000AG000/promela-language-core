typedef Packet {
    int value
};
mtype = { ready, finished };
int counter;
Packet packet;

active proctype Worker(byte input) {
    int counter;
    counter = input;
    packet.value = counter;
    goto done;
done: skip;
}
init {
    run Worker(ready);
}
