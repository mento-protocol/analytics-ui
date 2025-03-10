import useSWR from "swr";
import { fetcher } from "src/utils/fetcher";
import Allocation from "src/interfaces/allocation";
import StableValueTokensAPI from "src/interfaces/stable-value-tokens";
import useHoldings from "./useHoldings";
import { HoldingsApi } from "src/service/holdings";
import { calculateTargetAllocation } from "src/functions/calculateTargetAllocation";

const EMPTY_TARGETS: Allocation[] = [
  { type: "celo-native-asset" as const, token: "CELO", percent: 0 },
  { type: "other-crypto-assets" as const, token: "BTC", percent: 0 },
  { type: "other-crypto-assets" as const, token: "ETH", percent: 0 },
  { type: "other-crypto-assets" as const, token: "other", percent: 0 },
];

export default function useTargets() {
  const {
    data: stableTokensData,
    error: stableTokensError,
    isLoading: stableTokensLoading,
  } = useSWR<StableValueTokensAPI>("/api/stable-value-tokens", fetcher, {
    shouldRetryOnError: true,
  });

  const {
    data: holdingsData,
    error: holdingsError,
    isLoadingCelo,
    isLoadingOther,
  } = useHoldings();

  const isLoading = stableTokensLoading || isLoadingCelo || isLoadingOther;
  const error = stableTokensError || holdingsError;

  if (error || isLoading || !stableTokensData || !holdingsData) {
    return { data: EMPTY_TARGETS, isLoading: true };
  }

  const allocationData = calculateTargetAllocation(
    stableTokensData,
    getTotalReserveUSD(holdingsData),
  );

  return {
    data: allocationData,
    isLoading: false,
  };
}

function getTotalReserveUSD(reserveHoldings: HoldingsApi): number {
  const { custody, frozen, unfrozen } = reserveHoldings.celo;
  const totalCelo = custody.value + unfrozen.value + frozen.value;

  const totalOtherAssets = reserveHoldings?.otherAssets?.reduce(
    (prev, current) => current.value + prev,
    0,
  );

  return totalOtherAssets + totalCelo;
}
