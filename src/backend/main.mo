import Principal "mo:core/Principal";
import Array "mo:core/Array";
import Nat "mo:core/Nat";
import Time "mo:core/Time";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";

actor {
  // Types
  type Candle = {
    timestamp : Time.Time;
    open : Nat;
    high : Nat;
    low : Nat;
    close : Nat;
    volume : Nat;
  };

  type LiquidityLine = {
    price : Nat;
    createdAt : Time.Time;
    candlesSinceCreation : Nat;
  };

  type LiquidityBox = {
    minPrice : Nat;
    maxPrice : Nat;
    createdAt : Time.Time;
    candlesSinceCreation : Nat;
    isActive : Bool;
  };

  type IndicatorState = {
    liquiditiyLines : [LiquidityLine];
    liquiditiyBoxes : [LiquidityBox];
  };

  // Persistent State
  let userIndicators = Map.empty<Principal, IndicatorState>();

  // System Persistent State
  var monthlyCandles : [Candle] = [];
  var systemLiqLines : [LiquidityLine] = [];
  var systemLiqBoxes : [LiquidityBox] = [];

  public query ({ caller }) func getMonthlyCandles() : async [Candle] {
    monthlyCandles;
  };

  public query ({ caller }) func getAllLiquidityLines() : async [LiquidityLine] {
    switch (userIndicators.get(caller)) {
      case (null) { [] };
      case (?state) { state.liquiditiyLines };
    };
  };

  public query ({ caller }) func getAllLiquidityBoxes() : async [LiquidityBox] {
    switch (userIndicators.get(caller)) {
      case (null) { [] };
      case (?state) { state.liquiditiyBoxes };
    };
  };

  public shared ({ caller }) func createLiquidityLine(price : Nat) : async () {
    let newLine = {
      price;
      createdAt = Time.now();
      candlesSinceCreation = 0;
    };

    let currentState = switch (userIndicators.get(caller)) {
      case (null) { { liquiditiyLines = []; liquiditiyBoxes = [] } };
      case (?state) { state };
    };

    let newLines = [newLine].concat(currentState.liquiditiyLines);
    let newState : IndicatorState = {
      liquiditiyLines = newLines;
      liquiditiyBoxes = currentState.liquiditiyBoxes;
    };

    userIndicators.add(caller, newState);
  };

  public shared ({ caller }) func createLiquidityBox(minPrice : Nat, maxPrice : Nat) : async () {
    if (minPrice > maxPrice) {
      Runtime.trap("Min price cannot be greater than max price");
    };

    let newBox = {
      minPrice;
      maxPrice;
      createdAt = Time.now();
      candlesSinceCreation = 0;
      isActive = true;
    };

    let currentState = switch (userIndicators.get(caller)) {
      case (null) { { liquiditiyLines = []; liquiditiyBoxes = [] } };
      case (?state) { state };
    };

    let newBoxes = [newBox].concat(currentState.liquiditiyBoxes);
    let newState : IndicatorState = {
      liquiditiyLines = currentState.liquiditiyLines;
      liquiditiyBoxes = newBoxes;
    };

    userIndicators.add(caller, newState);
  };

  public shared ({ caller }) func markBoxAsInactive(boxId : Nat) : async () {
    let currentState = switch (userIndicators.get(caller)) {
      case (null) { Runtime.trap("No boxes to update") };
      case (?state) { state };
    };

    let boxes = currentState.liquiditiyBoxes;
    if (boxId >= boxes.size()) { Runtime.trap("Invalid boxId") };

    let updatedBoxes = Array.tabulate(
      boxes.size(),
      func(i) {
        if (i == boxId) {
          {
            minPrice = boxes[i].minPrice;
            maxPrice = boxes[i].maxPrice;
            createdAt = boxes[i].createdAt;
            candlesSinceCreation = boxes[i].candlesSinceCreation;
            isActive = false;
          };
        } else {
          boxes[i];
        };
      },
    );

    let newState : IndicatorState = {
      liquiditiyLines = currentState.liquiditiyLines;
      liquiditiyBoxes = updatedBoxes;
    };

    userIndicators.add(caller, newState);
  };

  public shared ({ caller }) func removeLiquidityBox(boxId : Nat) : async () {
    let currentState = switch (userIndicators.get(caller)) {
      case (null) { Runtime.trap("No boxes to remove") };
      case (?state) { state };
    };

    let boxes = currentState.liquiditiyBoxes;
    if (boxId >= boxes.size()) { Runtime.trap("Invalid boxId") };

    let boxedWithIndices = boxes.enumerate().toArray();
    let filteredBoxes = boxedWithIndices.filter(func((idx, box)) { idx != boxId }).map(func((idx, box)) { box });

    let newState : IndicatorState = {
      liquiditiyLines = currentState.liquiditiyLines;
      liquiditiyBoxes = filteredBoxes;
    };

    userIndicators.add(caller, newState);
  };
};
