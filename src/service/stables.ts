import { StableToken } from "@celo/contractkit";
import { CUSD_ADDRESS, RESERVE_MULTISIG_CELO } from "src/contract-addresses";
import { ISO427SYMBOLS } from "src/interfaces/ISO427SYMBOLS";
import {
  getCKESSupply,
  getCStableSupply,
  getCurveCUSD,
  getEXOFSupply,
  getMultisigCUSD,
  getPUSOSupply,
  getCCOPSupply,
} from "src/providers/Celo";
import { TokenModel } from "src/service/Data";
import { getOrSave } from "src/service/cache";
import { fiatPrices } from "src/service/rates";
import { ProviderResult } from "src/utils/ProviderResult";
import { okOrThrow, valueOrThrow } from "src/utils/Result";
import { SECOND } from "src/utils/TIME";
import { STABLES } from "../stables.config";
import { uniV3HoldingsForToken } from "./holdings";

async function cStableSupply(token: StableToken) {
  return getOrSave(
    `cSTABLE-${token}-supply`,
    () => getCStableSupply(token),
    5 * SECOND,
  );
}

async function curveCUSD() {
  return getOrSave("curvePoolCusd", () => getCurveCUSD(), 5 * SECOND);
}

async function multisigCUSD() {
  return getOrSave("multisigCUSD", () => getMultisigCUSD(), 5 * SECOND);
}

async function eXOFSupply() {
  return getOrSave("eXOFSupply", () => getEXOFSupply(), 5 * SECOND);
}

async function cKESSupply() {
  return getOrSave("cKESSupply", () => getCKESSupply(), 5 * SECOND);
}

async function PUSOSupply() {
  return getOrSave("PUSOSupply", () => getPUSOSupply(), 5 * SECOND);
}

async function cCOPSupply() {
  return getOrSave("cCOPSupply", () => getCCOPSupply(), 5 * SECOND);
}

interface Circulation {
  units: ProviderResult<number>;
  symbol: StableToken;
  iso4217: ISO427SYMBOLS;
}

async function getCirculations(): Promise<Circulation[]> {
  return Promise.all<Circulation>(
    STABLES.map(async (stable) => {
      return new Promise((resolve, reject) => {
        cStableSupply(stable.symbol)
          .then(
            (units) =>
              resolve({
                units: units,
                symbol: stable.symbol,
                iso4217: stable.iso4217,
              }),
            // reject(new Error(`error: getCirculation() provider: ${units.source}`))
          )
          .catch(reject);
      });
    }),
  );
}

export default async function stables(): Promise<TokenModel[]> {
  const [prices, circulations] = await Promise.all([
    fiatPrices(),
    getCirculations(),
  ]);

  // We need to get the reserve owned stables that have already been minted so we can adjust the total supply displayed
  const curveCUSDAmount = valueOrThrow(await curveCUSD());
  const multisigCUSDAmount = valueOrThrow(await multisigCUSD());
  const uniCUSDAmount = await uniV3HoldingsForToken(
    RESERVE_MULTISIG_CELO,
    CUSD_ADDRESS,
  );

  const tokens: TokenModel[] = circulations.map((tokenData) => {
    if (tokenData.units.hasError == true) {
      return {
        token: tokenData.symbol,
        units: null,
        value: null,
        updated: null,
        hasError: true,
      };
    }

    let units = tokenData.units.value;
    let value = prices.value[tokenData.iso4217] * units;

    // This adjusts the total supply to account for the reserve owned CUSD that have already been minted
    if (tokenData.symbol === StableToken.cUSD) {
      value -= curveCUSDAmount * prices.value[tokenData.iso4217];
      units -= curveCUSDAmount;

      value -= uniCUSDAmount * prices.value[tokenData.iso4217];
      units -= uniCUSDAmount;

      value -= multisigCUSDAmount * prices.value[tokenData.iso4217];
      units -= multisigCUSDAmount;
    }

    return {
      token: tokenData.symbol,
      units,
      value,
      updated: tokenData.units.time,
      hasError: tokenData.units.hasError,
    };
  });
  tokens.push(await getEXOFData());
  tokens.push(await getCKESData());
  tokens.push(await getPUSOData());
  tokens.push(await getCCOPData());
  return tokens;
}

export async function getTotalStableValueInUSD() {
  const all = await stables();
  return Number(all.reduce((sum, { value }) => sum + value, 0).toFixed(2));
}

export async function getEXOFData(): Promise<TokenModel> {
  try {
    const result = okOrThrow(await eXOFSupply());
    return {
      token: "eXOF",
      units: result.value,
      value: result.value * (await fiatPrices()).value["XOF"],
      updated: result.time,
      hasError: result.hasError,
    };
  } catch {
    return {
      token: "eXOF",
      units: null,
      value: null,
      updated: null,
      hasError: true,
    };
  }
}

export async function getCKESData(): Promise<TokenModel> {
  const kesData: TokenModel = {
    token: "cKES",
    units: null,
    value: null,
    updated: null,
    hasError: false,
  } as TokenModel;

  try {
    const result: ProviderResult<number> = await cKESSupply();

    if (result.hasError) {
      kesData.hasError = true;
      return kesData;
    } else if (result.hasError == false) {
      kesData.units = result.value;
      kesData.value = result.value * (await fiatPrices()).value["KES"];
      kesData.updated = result.time;
    }
  } catch {
    kesData.hasError = true;
  }
  return kesData;
}

export async function getPUSOData(): Promise<TokenModel> {
  const pusoData: TokenModel = {
    token: "PUSO",
    units: null,
    value: null,
    updated: null,
    hasError: false,
  } as TokenModel;

  try {
    const result: ProviderResult<number> = await PUSOSupply();

    if (result.hasError) {
      pusoData.hasError = true;
      return pusoData;
    } else if (result.hasError == false) {
      pusoData.units = result.value;
      pusoData.value = result.value * (await fiatPrices()).value["PHP"];
      pusoData.updated = result.time;
    }
  } catch {
    pusoData.hasError = true;
  }
  return pusoData;
}

export async function getCCOPData(): Promise<TokenModel> {
  const ccopData: TokenModel = {
    token: "cCOP",
    units: null,
    value: null,
    updated: null,
    hasError: false,
  } as TokenModel;

  try {
    const result: ProviderResult<number> = await cCOPSupply();
    if (result.hasError) {
      ccopData.hasError = true;
      return ccopData;
    } else if (result.hasError == false) {
      ccopData.units = result.value;
      ccopData.value = result.value * (await fiatPrices()).value["COP"];
      ccopData.updated = result.time;
    }
  } catch {
    ccopData.hasError = true;
  }
  return ccopData;
}
