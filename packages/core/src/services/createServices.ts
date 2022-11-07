import { ethers } from "ethers";

import { Journal } from "journal/types";
import { Providers } from "types/providers";
import { TxSender } from "utils/tx-sender";

import { ArtifactsService } from "./ArtifactsService";
import { ConfigService } from "./ConfigService";
import { ContractsService } from "./ContractsService";
import { TransactionsService } from "./TransactionsService";
import { Services } from "./types";

export function createServices(
  moduleId: string,
  executorId: string,
  {
    providers,
    journal,
    txPollingInterval,
  }: {
    providers: Providers;
    journal: Journal;
    txPollingInterval: number;
  }
): Services {
  const txSender = new TxSender(
    moduleId,
    executorId,
    providers.gasProvider,
    journal
  );

  const services: Services = {
    artifacts: new ArtifactsService(providers),
    contracts: new ContractsService(
      {
        gasProvider: providers.gasProvider,
        signersProvider: providers.signers,
        transactionsProvider: providers.transactions,
        web3Provider: new ethers.providers.Web3Provider(
          providers.ethereumProvider
        ),
      },
      txSender,
      {
        pollingInterval: txPollingInterval,
      }
    ),
    transactions: new TransactionsService(providers),
    config: new ConfigService(providers),
  };

  return services;
}