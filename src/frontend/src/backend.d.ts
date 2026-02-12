import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Candle {
    low: bigint;
    high: bigint;
    close: bigint;
    open: bigint;
    volume: bigint;
    timestamp: Time;
}
export interface LiquidityLine {
    createdAt: Time;
    candlesSinceCreation: bigint;
    price: bigint;
}
export type Time = bigint;
export interface LiquidityBox {
    createdAt: Time;
    candlesSinceCreation: bigint;
    isActive: boolean;
    maxPrice: bigint;
    minPrice: bigint;
}
export interface backendInterface {
    createLiquidityBox(minPrice: bigint, maxPrice: bigint): Promise<void>;
    createLiquidityLine(price: bigint): Promise<void>;
    getAllLiquidityBoxes(): Promise<Array<LiquidityBox>>;
    getAllLiquidityLines(): Promise<Array<LiquidityLine>>;
    getMonthlyCandles(): Promise<Array<Candle>>;
    markBoxAsInactive(boxId: bigint): Promise<void>;
    removeLiquidityBox(boxId: bigint): Promise<void>;
}
