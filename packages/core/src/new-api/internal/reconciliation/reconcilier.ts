import { ExecutionState, ExecutionStateMap } from "../../types/execution-state";
import { Future, IgnitionModule, ModuleParameters } from "../../types/module";
import { AdjacencyList } from "../utils/adjacency-list";
import { AdjacencyListConverter } from "../utils/adjacency-list-converter";
import { getFuturesFromModule } from "../utils/get-futures-from-module";

import { reconcileCurrentAndPreviousTypeMatch } from "./reconcileCurrentAndPreviousTypeMatch";
import { reconcileDependencyRules } from "./reconcileDependencyRules";
import { reconcileFutureSpecificReconciliations } from "./reconcileFutureSpecificReconciliations";
import {
  ReconciliationCheck,
  ReconciliationContext,
  ReconciliationFailure,
  ReconciliationFutureResult,
  ReconciliationFutureResultFailure,
  ReconciliationResult,
} from "./types";

export class Reconcilier {
  public static reconcile(
    module: IgnitionModule,
    executionStateMap: ExecutionStateMap,
    moduleParameters: ModuleParameters,
    accounts: string[]
  ): ReconciliationResult {
    const reconciliationFailures = this._reconcileEachFutureInModule(
      module,
      { executionStateMap, moduleParameters, accounts },
      [
        reconcileCurrentAndPreviousTypeMatch,
        reconcileDependencyRules,
        reconcileFutureSpecificReconciliations,
      ]
    );

    const missingExecutedFutures = this._missingPreviouslyExecutedFutures(
      module,
      executionStateMap
    );

    return { reconciliationFailures, missingExecutedFutures };
  }

  private static _reconcileEachFutureInModule(
    module: IgnitionModule,

    context: ReconciliationContext,
    checks: ReconciliationCheck[]
  ): ReconciliationFailure[] {
    // TODO: swap this out for linearization of execution state
    // once execution is fleshed out.
    const futures = this._getFuturesInReverseTopoligicalOrder(module);

    const failures = futures
      .map<[Future, ExecutionState]>((f) => [
        f,
        context.executionStateMap[f.id],
      ])
      .filter(([, exState]) => exState !== undefined)
      .map(([f, exState]) => this._check(f, exState, context, checks))
      .filter((r): r is ReconciliationFutureResultFailure => !r.success)
      .map((r) => r.failure);

    return failures;
  }

  private static _missingPreviouslyExecutedFutures(
    module: IgnitionModule,
    executionStateMap: ExecutionStateMap
  ) {
    const moduleFutures = new Set(
      getFuturesFromModule(module).map((f) => f.id)
    );

    const previouslyStarted = Object.values(executionStateMap).map(
      (es) => es.id
    );

    const missing = previouslyStarted.filter((sf) => !moduleFutures.has(sf));

    return missing;
  }

  private static _getFuturesInReverseTopoligicalOrder(
    module: IgnitionModule
  ): Future[] {
    const futures = getFuturesFromModule(module);

    const adjacencyList =
      AdjacencyListConverter.buildAdjacencyListFromFutures(futures);

    const sortedFutureIds =
      AdjacencyList.topologicalSort(adjacencyList).reverse();

    return sortedFutureIds
      .map((id) => futures.find((f) => f.id === id))
      .filter((x): x is Future => x !== undefined);
  }

  private static _check(
    future: Future,
    executionState: ExecutionState,
    context: ReconciliationContext,
    checks: ReconciliationCheck[]
  ): ReconciliationFutureResult {
    for (const check of checks) {
      const result = check(future, executionState, context);

      if (result.success) {
        continue;
      }

      return result;
    }

    return { success: true };
  }
}