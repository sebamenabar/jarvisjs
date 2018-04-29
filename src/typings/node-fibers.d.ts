// Type definitions for node-fibers
// Project: https://github.com/laverdet/node-fibers
// Definitions by: Cary Haynie <https://github.com/caryhaynie>
// Definitions: https://github.com/borisyankov/DefinitelyTyped
interface Fiber {
    reset: () => any;
    run: (param?: any) => any;
    throwInto: (ex: any) => any;
}

declare module "fibers" {

    export function Fiber(fn: Function): Fiber;

    export module Fiber {
        export var current: Fiber;
        export function yield(value?: any): any
        export var poolSize: number;
        export var fibersCreated: number;
    }
}

declare module "fibers/future" {

    export default class Future {
        constructor();
        detach(): void;
        get(): any;
        isResolved (): boolean;
        proxy(future: Future): void;
        proxyErrors(futureOrList: any): Future;
        resolver(): Function;
        resolve(fn: Function): void;
        resolveSuccess(fn: Function): void;
        return(result?: any): void;
        throw (error: any): void;
        wait (): void;
        static wait(future: Future): any;
        static wait(future_list: Future[]): any;
        static wrap(fn: Function): Future
    }
}