import { newKit } from '@celo/contractkit'
import BigNumber from 'bignumber.js'
import ProviderSource, { errorResult, Providers } from './ProviderSource'

const kit = newKit('https://forno.celo.org')



export async function getFrozenBalance(): Promise<ProviderSource> {
  try {
    const reserve = await kit.contracts.getReserve()
    const time = Date.now()
    return {hasError: false, value:0, source: Providers.forno, time}

  } catch (error) {
    return errorResult(error, Providers.forno)
  }
}

export async function getUnFrozenBalance() {
  const reserve = await kit.contracts.getReserve()
}

export async function getInCustodyBalance(): Promise<ProviderSource> {
  try {  const reserve = await kit.contracts.getReserve()
    const nativeToken = await kit.contracts.getGoldToken()
    const contractBalance = await nativeToken.balanceOf(reserve.address)
    const time = Date.now()
    // reserveCeloBalance includes both in contract and other address balances. need to subtract out
    const totalBalance = await reserve.getReserveGoldBalance()
    return {hasError: false, value: formatNumber(totalBalance.minus(contractBalance)), source: Providers.forno, time}
  } catch (error) {
    return errorResult(error, Providers.forno)
  }
}

export async function getcUSDSupply(): Promise<ProviderSource> {
  try {
    const stableToken = await kit.contracts.getStableToken()
    const totalSupply = await stableToken.totalSupply()
    const time = Date.now()
    return {hasError: false, value: formatNumber(totalSupply), source: Providers.forno, time}
  } catch (error) {
      return errorResult(error, Providers.forno)
  }
}

// TODO once EUR comes out
export async function getcEURSupply(): Promise<ProviderSource> {
  try{
    // const stableToken = await kit.contracts.getStableToken()
    // stableToken.totalSupply()
    return {hasError: false, value: 0, source: Providers.forno, time: Date.now()}
  } catch (error) {
    return errorResult(error, Providers.forno)
  }
}


export async function getTotalRatio() {
  const celoBalance = await getReserveCeloBalance()
  const totalStableValue = await totalValueOfStableTokens()
  console.log('cusd', formatNumber(totalStableValue))
  console.log('celoBalance', formatNumber(celoBalance))
  return celoBalance.dividedBy(totalStableValue)
}

export async function getUnFrozenRatio(): Promise<ProviderSource> {

}

const WEI_PER = 1_000_000_000_000_000_000

// Return value in CELO of stable Tokens
//  Todo get cEUR
async function totalValueOfStableTokens () {
  const exchange = await kit.contracts.getExchange()
  const cusdToken = await kit.contracts.getStableToken()
  const cUSDamount = await cusdToken.totalSupply()
  return exchange.quoteUsdSell(cUSDamount)
}

async function getReserveCeloBalance() {
  const reserve = await kit.contracts.getReserve()
  return reserve.getReserveGoldBalance()
}


function formatNumber(value: BigNumber) {
  return value.dividedBy(WEI_PER).toNumber()
}