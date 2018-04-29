"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const future_1 = require("fibers/future");
function asyncFunction() {
    const future = new future_1.default();
    setTimeout(() => future.return('done'), 1000);
    return future.wait();
}
function asyncWrapper() {
    console.log(1);
    console.log(asyncFunction());
    throw (new Error('fuck'));
    console.log(2);
}
function main() {
    const f = future_1.default.task(() => {
        future_1.default.wrap(asyncWrapper)();
    });
    f.detach();
}
main();
//# sourceMappingURL=generators.js.map