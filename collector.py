"""
collector.py
============
BTC Dashboard — 全市場データ並列収集モジュール。

collect_all() -> dict  を呼ぶと全APIを並列取得してスナップショットdictを返す。
目標実行時間: 8秒以内
"""
import asyncio
import re
import time
import logging
from datetime import datetime, timezone
from typing import Optional

import aiohttp
import pandas as pd

logger = logging.getLogger(__name__)

# ----------------------------------------------------------------
# 対象銘柄 (時価総額上位15・perp市場あり)
# ----------------------------------------------------------------
TOP15 = ["BTC", "ETH", "XRP", "BNB", "SOL", "TRX", "DOGE", "HYPE",
         "ADA", "LINK", "TON", "LTC", "AVAX", "DOT", "UNI"]

# ----------------------------------------------------------------
# 取引所ごとのシンボル名マッピング (multi_exchange_oi_fr.py から流用)
# ----------------------------------------------------------------
SYM: dict[str, dict[str, Optional[str]]] = {
    "BTC":  {"binance": "BTCUSDT",  "bybit": "BTCUSDT",   "okx": "BTC-USDT-SWAP",
             "hl": "BTC",           "gate": "BTC_USDT",    "bitget": "BTCUSDT",
             "mexc": "BTC_USDT",    "htx": "BTC-USDT",     "dydx": "BTC-USD",
             "bitmex": "XBTUSDT",   "bingx": "BTC",        "woox": "BTC"},
    "ETH":  {"binance": "ETHUSDT",  "bybit": "ETHUSDT",   "okx": "ETH-USDT-SWAP",
             "hl": "ETH",           "gate": "ETH_USDT",    "bitget": "ETHUSDT",
             "mexc": "ETH_USDT",    "htx": "ETH-USDT",     "dydx": "ETH-USD",
             "bitmex": "ETHUSDT",   "bingx": "ETH",        "woox": "ETH"},
    "XRP":  {"binance": "XRPUSDT",  "bybit": "XRPUSDT",   "okx": "XRP-USDT-SWAP",
             "hl": "XRP",           "gate": "XRP_USDT",    "bitget": "XRPUSDT",
             "mexc": "XRP_USDT",    "htx": "XRP-USDT",     "dydx": "XRP-USD",
             "bitmex": None,        "bingx": "XRP",        "woox": "XRP"},
    "BNB":  {"binance": "BNBUSDT",  "bybit": "BNBUSDT",   "okx": "BNB-USDT-SWAP",
             "hl": "BNB",           "gate": "BNB_USDT",    "bitget": "BNBUSDT",
             "mexc": "BNB_USDT",    "htx": None,            "dydx": None,
             "bitmex": None,        "bingx": "BNB",        "woox": None},
    "SOL":  {"binance": "SOLUSDT",  "bybit": "SOLUSDT",   "okx": "SOL-USDT-SWAP",
             "hl": "SOL",           "gate": "SOL_USDT",    "bitget": "SOLUSDT",
             "mexc": "SOL_USDT",    "htx": "SOL-USDT",     "dydx": "SOL-USD",
             "bitmex": None,        "bingx": "SOL",        "woox": "SOL"},
    "TRX":  {"binance": "TRXUSDT",  "bybit": "TRXUSDT",   "okx": "TRX-USDT-SWAP",
             "hl": "TRX",           "gate": "TRX_USDT",    "bitget": "TRXUSDT",
             "mexc": "TRX_USDT",    "htx": "TRX-USDT",     "dydx": None,
             "bitmex": None,        "bingx": "TRX",        "woox": None},
    "DOGE": {"binance": "DOGEUSDT", "bybit": "DOGEUSDT",  "okx": "DOGE-USDT-SWAP",
             "hl": "DOGE",          "gate": "DOGE_USDT",   "bitget": "DOGEUSDT",
             "mexc": "DOGE_USDT",   "htx": "DOGE-USDT",    "dydx": "DOGE-USD",
             "bitmex": None,        "bingx": "DOGE",       "woox": None},
    "HYPE": {"binance": None,       "bybit": "HYPEUSDT",  "okx": "HYPE-USDT-SWAP",
             "hl": "HYPE",          "gate": "HYPE_USDT",   "bitget": "HYPEUSDT",
             "mexc": "HYPE_USDT",   "htx": None,            "dydx": None,
             "bitmex": None,        "bingx": "HYPE",       "woox": None},
    "ADA":  {"binance": "ADAUSDT",  "bybit": "ADAUSDT",   "okx": "ADA-USDT-SWAP",
             "hl": "ADA",           "gate": "ADA_USDT",    "bitget": "ADAUSDT",
             "mexc": "ADA_USDT",    "htx": "ADA-USDT",     "dydx": None,
             "bitmex": None,        "bingx": "ADA",        "woox": None},
    "LINK": {"binance": "LINKUSDT", "bybit": "LINKUSDT",  "okx": "LINK-USDT-SWAP",
             "hl": "LINK",          "gate": "LINK_USDT",   "bitget": "LINKUSDT",
             "mexc": "LINK_USDT",   "htx": "LINK-USDT",    "dydx": "LINK-USD",
             "bitmex": None,        "bingx": "LINK",       "woox": None},
    "TON":  {"binance": "TONUSDT",  "bybit": "TONUSDT",   "okx": "TON-USDT-SWAP",
             "hl": "TON",           "gate": "TON_USDT",    "bitget": "TONUSDT",
             "mexc": "TON_USDT",    "htx": None,            "dydx": None,
             "bitmex": None,        "bingx": "TON",        "woox": None},
    "LTC":  {"binance": "LTCUSDT",  "bybit": "LTCUSDT",   "okx": "LTC-USDT-SWAP",
             "hl": "LTC",           "gate": "LTC_USDT",    "bitget": "LTCUSDT",
             "mexc": "LTC_USDT",    "htx": "LTC-USDT",     "dydx": "LTC-USD",
             "bitmex": None,        "bingx": "LTC",        "woox": None},
    "AVAX": {"binance": "AVAXUSDT", "bybit": "AVAXUSDT",  "okx": "AVAX-USDT-SWAP",
             "hl": "AVAX",          "gate": "AVAX_USDT",   "bitget": "AVAXUSDT",
             "mexc": "AVAX_USDT",   "htx": "AVAX-USDT",    "dydx": "AVAX-USD",
             "bitmex": None,        "bingx": "AVAX",       "woox": None},
    "DOT":  {"binance": "DOTUSDT",  "bybit": "DOTUSDT",   "okx": "DOT-USDT-SWAP",
             "hl": "DOT",           "gate": "DOT_USDT",    "bitget": "DOTUSDT",
             "mexc": "DOT_USDT",    "htx": "DOT-USDT",     "dydx": None,
             "bitmex": None,        "bingx": "DOT",        "woox": None},
    "UNI":  {"binance": "UNIUSDT",  "bybit": "UNIUSDT",   "okx": "UNI-USDT-SWAP",
             "hl": "UNI",           "gate": "UNI_USDT",    "bitget": "UNIUSDT",
             "mexc": "UNI_USDT",    "htx": "UNI-USDT",     "dydx": None,
             "bitmex": None,        "bingx": "UNI",        "woox": None},
}

TIMEOUT = aiohttp.ClientTimeout(total=10)
HEADERS = {"User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", "Accept": "application/json"}

# Binance L/S ratio エンドポイントの対象銘柄 (HYPEはBinance無し)
BN_LS_COINS = ["BTC", "ETH", "XRP", "BNB", "SOL", "TRX", "DOGE",
               "ADA", "LINK", "TON", "LTC", "AVAX", "DOT", "UNI"]


# ================================================================
# 共通ヘルパー
# ================================================================

async def _get(session: aiohttp.ClientSession, url: str,
               params: dict = None, body: dict = None,
               headers: dict = None) -> Optional[dict | list]:
    _h = {**HEADERS, **(headers or {})}
    try:
        if body is not None:
            async with session.post(url, json=body, headers=_h) as r:
                return await r.json(content_type=None) if r.status == 200 else None
        else:
            async with session.get(url, params=params, headers=_h) as r:
                return await r.json(content_type=None) if r.status == 200 else None
    except Exception as e:
        logger.debug("_get %s failed: %s", url, e)
        return None


async def _get_text(session: aiohttp.ClientSession, url: str,
                    headers: dict = None) -> Optional[str]:
    _h = {**HEADERS, **(headers or {})}
    try:
        async with session.get(url, headers=_h) as r:
            return await r.text() if r.status == 200 else None
    except Exception as e:
        logger.debug("_get_text %s failed: %s", url, e)
        return None


# ================================================================
# FR / OI 取得 (15銘柄 × 12取引所)
# ================================================================

async def _fetch_fr_oi_binance(session, coins):
    results = {}
    d = await _get(session, "https://fapi.binance.com/fapi/v1/premiumIndex")
    if not d or not isinstance(d, list):
        return results
    fr_map = {item["symbol"]: float(item["lastFundingRate"])
              for item in d if "lastFundingRate" in item}

    oi_tasks = {}
    for coin in coins:
        sym = SYM.get(coin, {}).get("binance")
        if sym:
            oi_tasks[coin] = asyncio.create_task(
                _get(session, "https://fapi.binance.com/fapi/v1/openInterest",
                     params={"symbol": sym}))

    for coin in coins:
        sym = SYM.get(coin, {}).get("binance")
        if not sym:
            continue
        fr = fr_map.get(sym)
        oi = None
        if coin in oi_tasks:
            r = await oi_tasks[coin]
            if r and "openInterest" in r:
                oi = float(r["openInterest"])
        if fr is not None or oi is not None:
            results[coin] = {"fr": fr, "oi_coin": oi, "oi_usd": None}
    return results


async def _fetch_fr_oi_bybit(session, coins):
    results = {}
    d = await _get(session, "https://api.bybit.com/v5/market/tickers",
                   params={"category": "linear"})
    if not d:
        return results
    ticker_map = {item["symbol"]: item
                  for item in d.get("result", {}).get("list", [])}

    oi_tasks = {}
    for coin in coins:
        sym = SYM.get(coin, {}).get("bybit")
        if sym:
            oi_tasks[coin] = asyncio.create_task(
                _get(session, "https://api.bybit.com/v5/market/open-interest",
                     params={"category": "linear", "symbol": sym,
                             "intervalTime": "1h", "limit": "1"}))

    for coin in coins:
        sym = SYM.get(coin, {}).get("bybit")
        if not sym:
            continue
        t = ticker_map.get(sym, {})
        fr_str = t.get("fundingRate")
        fr = float(fr_str) if fr_str else None
        oi = None
        if coin in oi_tasks:
            r = await oi_tasks[coin]
            lst = (r or {}).get("result", {}).get("list", [])
            if lst:
                oi = float(lst[0].get("openInterest", 0)) or None
        if fr is not None or oi is not None:
            results[coin] = {"fr": fr, "oi_coin": oi, "oi_usd": None}
    return results


async def _fetch_fr_oi_okx(session, coins):
    results = {}
    oi_all = await _get(session, "https://www.okx.com/api/v5/public/open-interest",
                        params={"instType": "SWAP"})
    oi_map = {}
    if oi_all:
        for item in oi_all.get("data", []):
            oi_map[item["instId"]] = float(item.get("oiCcy", 0))

    fr_tasks = {}
    for coin in coins:
        sym = SYM.get(coin, {}).get("okx")
        if sym:
            fr_tasks[coin] = asyncio.create_task(
                _get(session, "https://www.okx.com/api/v5/public/funding-rate",
                     params={"instId": sym}))

    for coin in coins:
        sym = SYM.get(coin, {}).get("okx")
        if not sym:
            continue
        fr = None
        if coin in fr_tasks:
            r = await fr_tasks[coin]
            if r:
                data = r.get("data", [])
                if data:
                    fr_str = data[0].get("fundingRate")
                    fr = float(fr_str) if fr_str else None
        oi = oi_map.get(sym)
        if fr is not None or oi is not None:
            results[coin] = {"fr": fr, "oi_coin": oi, "oi_usd": None}
    return results


async def _fetch_fr_oi_hyperliquid(session, coins):
    results = {}
    d = await _get(session, "https://api.hyperliquid.xyz/info",
                   body={"type": "metaAndAssetCtxs"})
    if not d or len(d) < 2:
        return results
    meta, ctxs = d
    idx = {u["name"]: i for i, u in enumerate(meta.get("universe", []))}

    for coin in coins:
        sym = SYM.get(coin, {}).get("hl")
        if not sym or sym not in idx:
            continue
        ctx = ctxs[idx[sym]]
        fr_str = ctx.get("funding")
        fr = float(fr_str) if fr_str else None
        oi = float(ctx.get("openInterest", 0)) or None
        mark = float(ctx.get("markPx", 0))
        oi_usd = oi * mark if oi and mark else None
        if fr is not None or oi is not None:
            results[coin] = {"fr": fr, "oi_coin": oi, "oi_usd": oi_usd}
    return results


async def _fetch_fr_oi_gate(session, coins):
    results = {}
    d = await _get(session, "https://api.gateio.ws/api/v4/futures/usdt/tickers")
    if not d or not isinstance(d, list):
        return results
    ticker_map = {item["contract"]: item for item in d}

    for coin in coins:
        sym = SYM.get(coin, {}).get("gate")
        if not sym:
            continue
        t = ticker_map.get(sym, {})
        fr_str = t.get("funding_rate")
        fr = float(fr_str) if fr_str else None
        total_size = float(t.get("total_size", 0))
        mark = float(t.get("mark_price", 0))
        oi_coin = total_size * 0.0001 if total_size else None
        oi_usd = oi_coin * mark if oi_coin and mark else None
        if fr is not None or oi_coin is not None:
            results[coin] = {"fr": fr, "oi_coin": oi_coin, "oi_usd": oi_usd}
    return results


async def _fetch_fr_oi_bitget(session, coins):
    results = {}
    tasks_fr = {}
    for coin in coins:
        sym = SYM.get(coin, {}).get("bitget")
        if sym:
            tasks_fr[coin] = asyncio.create_task(
                _get(session, "https://api.bitget.com/api/v2/mix/market/current-fund-rate",
                     params={"productType": "USDT-FUTURES", "symbol": sym}))

    for coin in tasks_fr:
        fr = None
        r = await tasks_fr[coin]
        if r:
            lst = r.get("data", [])
            if isinstance(lst, list) and lst:
                fr_str = lst[0].get("fundingRate")
                fr = float(fr_str) if fr_str else None
            elif isinstance(lst, dict):
                fr_str = lst.get("fundingRate")
                fr = float(fr_str) if fr_str else None
        if fr is not None:
            results[coin] = {"fr": fr, "oi_coin": None, "oi_usd": None}
    return results


async def _fetch_fr_mexc(session, coins):
    results = {}
    tasks = {}
    for coin in coins:
        sym = SYM.get(coin, {}).get("mexc")
        if sym:
            tasks[coin] = asyncio.create_task(
                _get(session,
                     f"https://contract.mexc.com/api/v1/contract/funding_rate/{sym}"))

    for coin, task in tasks.items():
        r = await task
        if r:
            fr_str = r.get("data", {}).get("fundingRate")
            if fr_str is not None:
                results[coin] = {"fr": float(fr_str), "oi_coin": None, "oi_usd": None}
    return results


async def _fetch_fr_htx(session, coins):
    results = {}
    tasks = {}
    for coin in coins:
        sym = SYM.get(coin, {}).get("htx")
        if sym:
            tasks[coin] = asyncio.create_task(
                _get(session,
                     "https://api.hbdm.com/linear-swap-api/v1/swap_funding_rate",
                     params={"contract_code": sym}))

    for coin, task in tasks.items():
        r = await task
        if r:
            data = r.get("data", {})
            fr_str = data.get("funding_rate") if isinstance(data, dict) else None
            if fr_str is not None:
                results[coin] = {"fr": float(fr_str), "oi_coin": None, "oi_usd": None}
    return results


async def _fetch_fr_dydx(session, coins):
    results = {}
    d = await _get(session, "https://indexer.dydx.trade/v4/perpetualMarkets")
    if not d:
        return results
    mkts = d.get("markets", {})
    for coin in coins:
        sym = SYM.get(coin, {}).get("dydx")
        if not sym:
            continue
        mkt = mkts.get(sym, {})
        fr_str = mkt.get("nextFundingRate")
        if fr_str is not None:
            results[coin] = {"fr": float(fr_str), "oi_coin": None, "oi_usd": None}
    return results


async def _fetch_fr_bitmex(session, coins):
    """BitMEX: BTC/ETH のみ対応、個別クエリで並列取得"""
    results = {}
    supported = [c for c in coins if SYM.get(c, {}).get("bitmex")]
    if not supported:
        return results

    tasks = {}
    for coin in supported:
        sym = SYM[coin]["bitmex"]
        tasks[coin] = asyncio.create_task(
            _get(session, "https://www.bitmex.com/api/v1/instrument",
                 params={"symbol": sym, "columns": "symbol,fundingRate"}))

    for coin, task in tasks.items():
        d = await task
        if d and isinstance(d, list) and d:
            fr = d[0].get("fundingRate")
            if fr is not None:
                results[coin] = {"fr": float(fr), "oi_coin": None, "oi_usd": None}
    return results


async def _fetch_fr_bingx(session, coins):
    results = {}
    tasks = {}
    for coin in coins:
        sym = SYM.get(coin, {}).get("bingx")
        if sym:
            tasks[coin] = asyncio.create_task(
                _get(session,
                     "https://open-api.bingx.com/openApi/swap/v2/quote/fundingRate",
                     params={"symbol": f"{sym}-USDT"}))

    for coin, task in tasks.items():
        r = await task
        if r:
            data = r.get("data")
            if isinstance(data, list) and data:
                fr_str = data[0].get("fundingRate")
            elif isinstance(data, dict):
                fr_str = data.get("fundingRate")
            else:
                fr_str = None
            if fr_str is not None:
                results[coin] = {"fr": float(fr_str), "oi_coin": None, "oi_usd": None}
    return results


async def _fetch_fr_woox(session, coins):
    results = {}
    tasks = {}
    for coin in coins:
        sym = SYM.get(coin, {}).get("woox")
        if sym:
            tasks[coin] = asyncio.create_task(
                _get(session,
                     f"https://api.woo.org/v1/public/funding_rate/PERP_{sym}_USDT"))

    for coin, task in tasks.items():
        r = await task
        if r:
            fr_str = r.get("last_funding_rate")
            if fr_str is not None:
                results[coin] = {"fr": float(fr_str), "oi_coin": None, "oi_usd": None}
    return results


async def _fetch_all_fr_oi(session, coins=TOP15):
    """全取引所から FR/OI を並列取得。戻り値: {coin: {exchange: {fr, oi_coin, oi_usd}}}"""
    exchange_fetchers = {
        "binance":     _fetch_fr_oi_binance(session, coins),
        "bybit":       _fetch_fr_oi_bybit(session, coins),
        "okx":         _fetch_fr_oi_okx(session, coins),
        "hyperliquid": _fetch_fr_oi_hyperliquid(session, coins),
        "gate":        _fetch_fr_oi_gate(session, coins),
        "bitget":      _fetch_fr_oi_bitget(session, coins),
        "mexc":        _fetch_fr_mexc(session, coins),
        "htx":         _fetch_fr_htx(session, coins),
        "dydx":        _fetch_fr_dydx(session, coins),
        "bitmex":      _fetch_fr_bitmex(session, coins),
        "bingx":       _fetch_fr_bingx(session, coins),
        "woox":        _fetch_fr_woox(session, coins),
    }
    gathered = await asyncio.gather(*exchange_fetchers.values(), return_exceptions=True)

    exchange_data = {}
    for exch, result in zip(exchange_fetchers.keys(), gathered):
        if isinstance(result, Exception):
            logger.warning("FR/OI %s failed: %s", exch, result)
            exchange_data[exch] = {}
        else:
            exchange_data[exch] = result or {}

    # coin → exchange 形式に転置
    out = {coin: {} for coin in coins}
    for exch, coin_data in exchange_data.items():
        for coin, vals in coin_data.items():
            out[coin][exch] = vals
    return out


def _build_funding_rates(raw: dict) -> dict:
    """raw {coin: {exch: {fr, oi_coin, oi_usd}}} -> {coin: {exch: fr_float}}"""
    result = {}
    for coin, exch_data in raw.items():
        result[coin] = {}
        for exch, vals in exch_data.items():
            fr = vals.get("fr")
            if fr is not None:
                result[coin][exch] = fr
    return result


def _build_fr_aggregate(raw: dict) -> dict:
    result = {}
    for coin, exch_data in raw.items():
        frs = [v["fr"] for v in exch_data.values() if v.get("fr") is not None]
        if not frs:
            result[coin] = {"avg": None, "max": None, "min": None,
                            "spread": None, "n_exchanges": 0}
            continue
        avg = sum(frs) / len(frs)
        mx = max(frs)
        mn = min(frs)
        result[coin] = {
            "avg": round(avg, 6),
            "max": round(mx, 6),
            "min": round(mn, 6),
            "spread": round(mx - mn, 6),
            "n_exchanges": len(frs),
        }
    return result


def _build_open_interest(raw: dict) -> dict:
    """{coin: {exch: {oi_coin, oi_usd}}}"""
    result = {}
    for coin, exch_data in raw.items():
        result[coin] = {}
        for exch, vals in exch_data.items():
            oi_c = vals.get("oi_coin")
            oi_u = vals.get("oi_usd")
            if oi_c is not None or oi_u is not None:
                result[coin][exch] = {"oi_coin": oi_c, "oi_usd": oi_u}
    return result


def _build_oi_total(raw: dict) -> dict:
    result = {}
    for coin, exch_data in raw.items():
        coins_list = [v["oi_coin"] for v in exch_data.values()
                      if v.get("oi_coin") is not None]
        usds_list = [v["oi_usd"] for v in exch_data.values()
                     if v.get("oi_usd") is not None]
        result[coin] = {
            "total_coin": round(sum(coins_list), 2) if coins_list else None,
            "total_usd": round(sum(usds_list), 0) if usds_list else None,
        }
    return result


# ================================================================
# BTC 基本価格
# ================================================================

async def _fetch_btc_price(session) -> Optional[float]:
    # Binance Spot → Binance Futures → CoinGecko の順でフォールバック
    sources = [
        ("https://api.binance.com/api/v3/ticker/price", {"symbol": "BTCUSDT"}, "price"),
        ("https://fapi.binance.com/fapi/v1/ticker/price", {"symbol": "BTCUSDT"}, "price"),
        ("https://api.coinbase.com/v2/prices/BTC-USD/spot", None, None),
    ]
    for url, params, key in sources:
        d = await _get(session, url, params=params)
        if not d:
            continue
        try:
            if key:
                return float(d[key])
            # Coinbase
            return float(d["data"]["amount"])
        except Exception:
            continue
    return None


async def _fetch_btc_dominance(session) -> Optional[float]:
    d = await _get(session, "https://api.coingecko.com/api/v3/global")
    if d:
        try:
            return float(d["data"]["market_cap_percentage"]["btc"])
        except Exception:
            pass
    return None


async def _fetch_coinbase_premium(session, btc_price) -> Optional[float]:
    d = await _get(session, "https://api.coinbase.com/v2/prices/BTC-USD/spot")
    if d:
        try:
            cb = float(d["data"]["amount"])
            if btc_price:
                return round((cb - btc_price) / btc_price, 6)  # raw decimal (×100不要)
        except Exception:
            pass
    return None


# ================================================================
# Mempool
# ================================================================

async def _fetch_mempool(session) -> dict:
    result = {"count": None, "vsize": None, "fee_fast": None, "fee_medium": None}
    mp, fees = await asyncio.gather(
        _get(session, "https://mempool.space/api/mempool"),
        _get(session, "https://mempool.space/api/v1/fees/recommended"),
        return_exceptions=True
    )
    if isinstance(mp, dict):
        result["count"] = mp.get("count")
        result["vsize"] = mp.get("vsize")
    if isinstance(fees, dict):
        result["fee_fast"] = fees.get("fastestFee")
        result["fee_medium"] = fees.get("halfHourFee")
    return result


# ================================================================
# ボラティリティ (Deribit)
# ================================================================

async def _fetch_vol(session) -> dict:
    result = {
        "dvol": None, "realized_vol": None, "vrp": None,
        "futures_premium_pct": None, "pc_ratio": None,
        "rr_7d": None, "rr_14d": None, "rr_30d": None,
        "term_structure": {},
    }
    now_ms = int(time.time() * 1000)

    dvol_task = asyncio.create_task(_get(
        session,
        "https://www.deribit.com/api/v2/public/get_volatility_index_data",
        params={"currency": "BTC", "resolution": "3600",
                "start_timestamp": str(now_ms - 7_200_000),
                "end_timestamp": str(now_ms)}))

    rv_task = asyncio.create_task(_get(
        session,
        "https://www.deribit.com/api/v2/public/get_historical_volatility",
        params={"currency": "BTC"}))

    fut_task = asyncio.create_task(_get(
        session,
        "https://www.deribit.com/api/v2/public/get_book_summary_by_currency",
        params={"currency": "BTC", "kind": "future"}))

    opt_task = asyncio.create_task(_get(
        session,
        "https://www.deribit.com/api/v2/public/get_book_summary_by_currency",
        params={"currency": "BTC", "kind": "option"}))

    # DVOL
    d = await dvol_task
    if d:
        try:
            data = d.get("result", {}).get("data", [])
            if data:
                result["dvol"] = round(float(data[-1][4]), 2)
        except Exception:
            pass

    # Realized vol
    d = await rv_task
    if d:
        try:
            rv_data = d.get("result", [])
            if rv_data:
                result["realized_vol"] = round(float(rv_data[-1][1]), 2)
        except Exception:
            pass

    if result["dvol"] and result["realized_vol"]:
        result["vrp"] = round(result["dvol"] - result["realized_vol"], 2)

    # Futures (premium + term structure)
    d = await fut_task
    if d:
        try:
            items = d.get("result", [])
            perp = next((x for x in items if "PERPETUAL" in x.get("instrument_name", "")), None)
            non_perp = [x for x in items if "PERPETUAL" not in x.get("instrument_name", "")]
            if perp and non_perp:
                perp_px = float(perp.get("mark_price", 0))
                nearest = sorted(non_perp, key=lambda x: x.get("instrument_name", ""))[0]
                near_px = float(nearest.get("mark_price", 0))
                if perp_px:
                    result["futures_premium_pct"] = round(
                        (near_px - perp_px) / perp_px * 100, 4)
        except Exception:
            pass

    # P/C ratio
    d = await opt_task
    if d:
        try:
            items = d.get("result", [])
            put_vol = sum(float(x.get("volume", 0)) for x in items if "-P" in x.get("instrument_name", ""))
            call_vol = sum(float(x.get("volume", 0)) for x in items if "-C" in x.get("instrument_name", ""))
            if call_vol > 0:
                result["pc_ratio"] = round(put_vol / call_vol, 4)
        except Exception:
            pass

    return result


# ================================================================
# ステーブルコイン (DeFiLlama)
# ================================================================

async def _fetch_stablecoins(session) -> dict:
    result = {"usdt_usd": None, "usdc_usd": None, "usde_usd": None,
              "total_usd": None, "weekly_change_pct": None}
    d = await _get(session, "https://stablecoins.llama.fi/stablecoins")
    if not d:
        return result
    try:
        assets = d.get("peggedAssets", [])
        usd_assets = [a for a in assets if a.get("pegType") == "peggedUSD"]

        name_map = {"Tether": "usdt_usd", "USD Coin": "usdc_usd", "Ethena USDe": "usde_usd"}
        total = 0.0
        total_prev = 0.0

        for a in usd_assets:
            circ = a.get("circulating", {}).get("peggedUSD", 0) or 0
            prev = a.get("circulatingPrevWeek", {}).get("peggedUSD", 0) or 0
            total += circ
            total_prev += prev
            for name_key, field in name_map.items():
                if name_key in a.get("name", ""):
                    result[field] = circ

        result["total_usd"] = total
        if total_prev:
            result["weekly_change_pct"] = round((total - total_prev) / total_prev * 100, 4)
    except Exception as e:
        logger.warning("stablecoins parse error: %s", e)
    return result


# ================================================================
# マクロ (Yahoo Finance)
# ================================================================

async def _fetch_macro(session) -> dict:
    result = {"spy": None, "gld": None, "oil": None,
              "us10y": None, "us02y": None, "yield_spread": None}
    ticker_map = {
        "SPY": "spy", "GLD": "gld", "CL=F": "oil",
        "^TNX": "us10y", "^IRX": "us02y",
    }
    # Yahoo Finance requires a cookie header to bypass 429 rate limiting
    yahoo_headers = {
        "User-Agent": "Mozilla/5.0 (compatible)",
        "Cookie": "B=abc123; YFC=abc",
        "Accept": "application/json",
    }

    async def _yahoo_fetch(ticker: str) -> Optional[float]:
        for host in ("query1", "query2"):
            url = f"https://{host}.finance.yahoo.com/v8/finance/chart/{ticker}"
            try:
                async with session.get(url, params={"interval": "1d", "range": "5d"},
                                       headers=yahoo_headers) as r:
                    if r.status == 200:
                        d = await r.json(content_type=None)
                        closes = d["chart"]["result"][0]["indicators"]["quote"][0]["close"]
                        val = next((v for v in reversed(closes) if v is not None), None)
                        return round(float(val), 4) if val is not None else None
            except Exception:
                pass
        return None

    tasks = {ticker: asyncio.create_task(_yahoo_fetch(ticker))
             for ticker in ticker_map}

    for ticker, task in tasks.items():
        val = await task
        field = ticker_map[ticker]
        result[field] = val

    if result["us10y"] is not None and result["us02y"] is not None:
        result["yield_spread"] = round(result["us10y"] - result["us02y"], 4)
    return result


# ================================================================
# ETF Flow (Farside + SoSoValue)
# ================================================================

_MONTH_MAP = {
    "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04",
    "May": "05", "Jun": "06", "Jul": "07", "Aug": "08",
    "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12",
}


def _parse_farside_html(html: str) -> dict:
    """Farside HTML から ETF フロー情報をパース。
    日付形式: '08 May 2026'  負値形式: '(27.2)' -> -27.2
    """
    result = {"latest_date": None, "daily_total_musd": None, "tickers": {}}
    try:
        rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.DOTALL)

        # ヘッダー行を見つける
        header_row = None
        for row in rows:
            cells = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row, re.DOTALL)
            texts = [re.sub(r"<[^>]+>", "", c).strip() for c in cells]
            if "IBIT" in texts and "Date" in texts:
                header_row = texts
                break

        if not header_row:
            return result

        target_tickers = ["IBIT", "FBTC", "GBTC", "Total"]
        ticker_idx = {t: header_row.index(t) for t in target_tickers if t in header_row}

        def parse_val(s: str) -> Optional[float]:
            s = s.strip().replace(",", "")
            if not s or s in ("-", "n/a", "N/A"):
                return None
            neg = re.match(r"\(([0-9.]+)\)", s)
            if neg:
                return -float(neg.group(1))
            try:
                return float(s)
            except ValueError:
                return None

        # データ行を収集 (DD Mon YYYY 形式)
        data_rows = []
        for row in rows:
            cells = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row, re.DOTALL)
            texts = [re.sub(r"<[^>]+>", "", c).strip() for c in cells]
            if not texts:
                continue
            m = re.match(r"(\d{1,2})\s+(\w{3})\s+(\d{4})", texts[0])
            if m:
                data_rows.append(texts)

        if not data_rows:
            return result

        latest = data_rows[-1]
        m = re.match(r"(\d{1,2})\s+(\w{3})\s+(\d{4})", latest[0])
        if m:
            dd, mon, yyyy = m.group(1), m.group(2), m.group(3)
            mm = _MONTH_MAP.get(mon, "00")
            result["latest_date"] = f"{yyyy}-{mm}-{dd.zfill(2)}"

        for ticker, idx in ticker_idx.items():
            if idx < len(latest):
                result["tickers"][ticker] = parse_val(latest[idx])

        if "Total" in result["tickers"]:
            result["daily_total_musd"] = result["tickers"]["Total"]

    except Exception as e:
        logger.warning("farside parse error: %s", e)
    return result


_SOSO_HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://sosovalue.com/assets/etf/us-bitcoin-spot-etf",
    "Origin": "https://sosovalue.com",
}
_SOSO_URL = "https://gw.sosovalue.com/finance/etf-statistics-do/findPage"
_SOSO_BODY_BASE = {"market": "US", "currencyName": "BTC", "isListing": 1, "status": 1}


async def _fetch_soso_latest(session) -> Optional[dict]:
    """SoSoValue: 総件数を取得してから最終ページの最新行を返す"""
    import math
    # Step 1: 件数取得 (page 1, size 1)
    d1 = await _get(session, _SOSO_URL,
                    body={**_SOSO_BODY_BASE, "pageNum": 1, "pageSize": 1},
                    headers=_SOSO_HEADERS)
    if not d1:
        return None
    total = int(d1.get("data", {}).get("total", 0) or 0)
    if not total:
        return None

    # Step 2: 最終ページ取得
    page_size = 3
    last_page = math.ceil(total / page_size)
    d2 = await _get(session, _SOSO_URL,
                    body={**_SOSO_BODY_BASE, "pageNum": last_page, "pageSize": page_size},
                    headers=_SOSO_HEADERS)
    if not d2:
        return None
    lst = d2.get("data", {}).get("list", [])
    return lst[-1] if lst else None


async def _fetch_etf_flow(session) -> dict:
    result = {"latest_date": None, "daily_total_musd": None,
              "cumulative_usd": None, "total_assets_usd": None, "tickers": {}}

    farside_task = asyncio.create_task(
        _get(session, "https://farside.co.uk/wp-json/wp/v2/pages/1321"))

    soso_task = asyncio.create_task(_fetch_soso_latest(session))

    farside_json = await farside_task
    if farside_json:
        try:
            if isinstance(farside_json, dict):
                html = farside_json.get("content", {}).get("rendered", "")
            elif isinstance(farside_json, list) and farside_json:
                html = farside_json[0].get("content", {}).get("rendered", "")
            else:
                html = ""
            if html:
                parsed = _parse_farside_html(html)
                result.update(parsed)
        except Exception as e:
            logger.warning("farside etf parse: %s", e)

    latest = await soso_task
    if latest:
        try:
            cum = latest.get("cumNetInflow")
            result["cumulative_usd"] = float(cum) if cum else None
            assets = latest.get("totalNetAssets")
            result["total_assets_usd"] = float(assets) if assets else None
        except Exception as e:
            logger.warning("sosovalue etf parse: %s", e)

    return result


# ================================================================
# Exchange Flow (Coinmetrics)
# ================================================================

async def _fetch_exchange_flow(session) -> dict:
    result = {"date": None, "inflow_usd": None, "outflow_usd": None,
              "net_usd": None, "exchange_balance_btc": None}
    d = await _get(
        session,
        "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics",
        params={"assets": "btc",
                "metrics": "FlowInExUSD,FlowOutExUSD,SplyExNtv",
                "page_size": "3"})
    if not d:
        return result
    try:
        rows = d.get("data", [])
        if not rows:
            return result
        # 最新（暫定値を避けるため -1 ではなく確定値 [-2] を使用するが、
        # community API は page_size=3 で返るので最後から2番目が安定値
        entry = rows[-2] if len(rows) >= 2 else rows[-1]
        result["date"] = entry.get("time", "")[:10]
        inf = entry.get("FlowInExUSD")
        outf = entry.get("FlowOutExUSD")
        sply = entry.get("SplyExNtv")
        result["inflow_usd"] = float(inf) if inf else None
        result["outflow_usd"] = float(outf) if outf else None
        if inf and outf:
            result["net_usd"] = float(inf) - float(outf)
        result["exchange_balance_btc"] = float(sply) if sply else None
    except Exception as e:
        logger.warning("exchange flow parse: %s", e)
    return result


# ================================================================
# Polymarket
# ================================================================

async def _fetch_polymarket(session) -> list:
    """Polymarket の BTC 関連予測市場を取得"""
    result = []
    try:
        d = await _get(
            session,
            "https://gamma-api.polymarket.com/markets",
            params={"active": "true", "closed": "false",
                    "tag_slug": "crypto", "limit": "50"})
        if not d:
            return result
        items = d if isinstance(d, list) else d.get("markets", [])
        btc_items = [m for m in items
                     if "btc" in m.get("question", "").lower()
                     or "bitcoin" in m.get("question", "").lower()]
        for m in btc_items[:5]:
            yes_pct = None
            outcomes = m.get("outcomes")
            prices = m.get("outcomePrices")
            if outcomes and prices:
                try:
                    yes_idx = outcomes.index("Yes")
                    yes_pct = round(float(prices[yes_idx]) * 100, 1)
                except (ValueError, IndexError):
                    pass
            result.append({
                "question": m.get("question", ""),
                "yes_pct": yes_pct,
                "volume": float(m.get("volume", 0) or 0),
            })
    except Exception as e:
        logger.warning("polymarket: %s", e)
    return result


# ================================================================
# 清算データ
# ================================================================

async def _fetch_okx_liquidations(session) -> tuple:
    """OKX BTC 清算量。returns (long_liq_btc, short_liq_btc)"""
    long_liq = 0.0
    short_liq = 0.0
    d = await _get(
        session,
        "https://www.okx.com/api/v5/public/liquidation-orders",
        params={"instType": "SWAP", "uly": "BTC-USD", "state": "filled", "limit": "100"})
    if not d:
        return long_liq, short_liq
    try:
        for item in d.get("data", []):
            for detail in item.get("details", []):
                side = detail.get("side", "")
                sz = float(detail.get("sz", 0) or 0)
                if side == "sell":
                    long_liq += sz
                elif side == "buy":
                    short_liq += sz
    except Exception as e:
        logger.warning("okx liq: %s", e)
    return long_liq, short_liq


async def _fetch_bitmex_liquidations(session) -> tuple:
    """BitMEX BTC/USDT 清算 → (long_btc, short_btc, count, events)"""
    long_btc = 0.0
    short_btc = 0.0
    events = []
    d = await _get(session, "https://www.bitmex.com/api/v1/liquidation",
                   params={"symbol": "XBTUSDT", "count": "50", "reverse": "true"})
    if d and isinstance(d, list):
        try:
            for item in d:
                side  = item.get("side", "")  # Buy=short清算, Sell=long清算
                price = float(item.get("price", 0) or 0)
                qty   = float(item.get("leavesQty", 0) or 0)  # linear: BTC単位
                if price > 0 and qty > 0:
                    liq_side = "short" if side == "Buy" else "long"
                    if side == "Buy":
                        short_btc += qty
                    else:
                        long_btc  += qty
                    events.append({"exchange": "bitmex", "price": round(price, 2),
                                   "side": liq_side, "size_btc": round(qty, 4), "time_ms": 0})
        except Exception as e:
            logger.warning("bitmex liq: %s", e)
    return long_btc, short_btc, len(events), events


async def _fetch_binance_liquidations(session) -> tuple:
    """Binance BTC/USDT 強制清算 → (long_btc, short_btc, events)"""
    long_btc = 0.0
    short_btc = 0.0
    events = []
    d = await _get(session, "https://fapi.binance.com/fapi/v1/forceOrders",
                   params={"symbol": "BTCUSDT", "autoCloseType": "LIQUIDATION", "limit": "50"})
    if not d or not isinstance(d, list):
        return long_btc, short_btc, events
    try:
        for item in d:
            side  = item.get("side", "")  # BUY=short清算, SELL=long清算
            price = float(item.get("avgPrice", 0) or 0)
            qty   = float(item.get("origQty",  0) or 0)
            ts    = int(item.get("time", 0) or 0)
            if price > 0 and qty > 0:
                liq_side = "short" if side == "BUY" else "long"
                if side == "BUY":
                    short_btc += qty
                else:
                    long_btc  += qty
                events.append({"exchange": "binance", "price": round(price, 2),
                               "side": liq_side, "size_btc": round(qty, 4), "time_ms": ts})
    except Exception as e:
        logger.warning("binance liq: %s", e)
    return long_btc, short_btc, events


async def _fetch_bybit_liquidations(session) -> tuple:
    """Bybit BTC/USDT 清算 → (long_btc, short_btc, events)"""
    long_btc = 0.0
    short_btc = 0.0
    events = []
    d = await _get(session, "https://api.bybit.com/v5/market/liquidation",
                   params={"category": "linear", "symbol": "BTCUSDT", "limit": "50"})
    if not d:
        return long_btc, short_btc, events
    try:
        items = d.get("result", {}).get("list", [])
        for item in items:
            side  = item.get("side", "")  # Buy=short清算, Sell=long清算
            price = float(item.get("price", 0) or 0)
            qty   = float(item.get("qty",   0) or 0)
            ts    = int(item.get("time",    0) or 0)
            if price > 0 and qty > 0:
                liq_side = "short" if side == "Buy" else "long"
                if side == "Buy":
                    short_btc += qty
                else:
                    long_btc  += qty
                events.append({"exchange": "bybit", "price": round(price, 2),
                               "side": liq_side, "size_btc": round(qty, 4), "time_ms": ts})
    except Exception as e:
        logger.warning("bybit liq: %s", e)
    return long_btc, short_btc, events


async def _fetch_bn_ls(session, coins=BN_LS_COINS):
    """Binance taker L/S ratio, account L/S, top trader L/S を並列取得"""
    taker_tasks = {}
    acct_tasks = {}
    top_tasks = {}
    for coin in coins:
        sym = SYM.get(coin, {}).get("binance")
        if not sym:
            continue
        taker_tasks[coin] = asyncio.create_task(
            _get(session,
                 "https://fapi.binance.com/futures/data/takerlongshortRatio",
                 params={"symbol": sym, "period": "1h", "limit": "1"}))
        acct_tasks[coin] = asyncio.create_task(
            _get(session,
                 "https://fapi.binance.com/futures/data/globalLongShortAccountRatio",
                 params={"symbol": sym, "period": "1h", "limit": "1"}))
        top_tasks[coin] = asyncio.create_task(
            _get(session,
                 "https://fapi.binance.com/futures/data/topLongShortPositionRatio",
                 params={"symbol": sym, "period": "1h", "limit": "1"}))

    bn_taker = {}
    bn_acct = {}
    bn_top = {}

    for coin in taker_tasks:
        r = await taker_tasks[coin]
        if r and isinstance(r, list) and r:
            row = r[0]
            try:
                bn_taker[coin] = {
                    "buy_vol": float(row.get("buyVol", 0)),
                    "sell_vol": float(row.get("sellVol", 0)),
                    "ratio": float(row.get("buySellRatio", 0)),
                }
            except Exception:
                pass

        r = await acct_tasks[coin]
        if r and isinstance(r, list) and r:
            row = r[0]
            try:
                bn_acct[coin] = {
                    "long": float(row.get("longAccount", 0)),
                    "short": float(row.get("shortAccount", 0)),
                    "ratio": float(row.get("longShortRatio", 0)),
                }
            except Exception:
                pass

        r = await top_tasks[coin]
        if r and isinstance(r, list) and r:
            row = r[0]
            try:
                bn_top[coin] = {
                    "long": float(row.get("longAccount", 0)),
                    "short": float(row.get("shortAccount", 0)),
                    "ratio": float(row.get("longShortRatio", 0)),
                }
            except Exception:
                pass

    return bn_taker, bn_acct, bn_top


# ================================================================
# テクニカル指標 (SMA / RSI / トレンド)
# ================================================================

def _calc_sma(closes: list, n: int) -> Optional[float]:
    if len(closes) < n:
        return None
    return sum(closes[-n:]) / n


def _calc_rsi14(closes: list) -> Optional[float]:
    if len(closes) < 15:
        return None
    try:
        s = pd.Series(closes, dtype=float)
        delta = s.diff()
        gain = delta.clip(lower=0).ewm(span=14, adjust=False).mean()
        loss = (-delta.clip(upper=0)).ewm(span=14, adjust=False).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        val = rsi.iloc[-1]
        return round(float(val), 2) if not pd.isna(val) else None
    except Exception:
        return None


def _sma_dir(closes: list, n: int) -> str:
    """SMAの方向: 最新値と3本前を比較"""
    if len(closes) < n + 3:
        return "flat"
    sma_now = sum(closes[-n:]) / n
    sma_prev = sum(closes[-n - 3:-3]) / n
    diff = sma_now - sma_prev
    threshold = sma_now * 0.0001  # 0.01% 未満はflat
    if diff > threshold:
        return "up"
    elif diff < -threshold:
        return "down"
    return "flat"


async def _fetch_klines(session: aiohttp.ClientSession, interval: str, limit: int = 250) -> list:
    """Binance Futures OHLCV を取得して [timestamp, open, high, low, close, volume] リストを返す"""
    d = await _get(
        session,
        "https://fapi.binance.com/fapi/v1/klines",
        params={"symbol": "BTCUSDT", "interval": interval, "limit": limit})
    if not d or not isinstance(d, list):
        return []
    candles = []
    for row in d:
        try:
            candles.append({
                "t": int(row[0]),
                "o": float(row[1]),
                "h": float(row[2]),
                "l": float(row[3]),
                "c": float(row[4]),
                "v": float(row[5]),
            })
        except Exception:
            continue
    return candles


def _build_tf_data(candles: list) -> dict:
    """ローソク足リストからSMA/RSI/トレンドスコアを計算"""
    if not candles:
        return {}
    closes = [c["c"] for c in candles]
    price = closes[-1]
    sma20  = _calc_sma(closes, 20)
    sma75  = _calc_sma(closes, 75)
    sma200 = _calc_sma(closes, 200)
    rsi14  = _calc_rsi14(closes)

    def _vs(sma):
        if sma is None:
            return None
        return "above" if price > sma else "below"

    score = 0
    if sma20  is not None: score += (1 if price > sma20  else -1)
    if sma75  is not None: score += (1 if price > sma75  else -1)
    if sma200 is not None: score += (1 if price > sma200 else -1)

    return {
        "price":      round(price, 2),
        "sma20":      round(sma20,  2) if sma20  is not None else None,
        "sma75":      round(sma75,  2) if sma75  is not None else None,
        "sma200":     round(sma200, 2) if sma200 is not None else None,
        "rsi14":      rsi14,
        "vs_sma20":   _vs(sma20),
        "vs_sma75":   _vs(sma75),
        "vs_sma200":  _vs(sma200),
        "sma20_dir":  _sma_dir(closes, 20),
        "sma75_dir":  _sma_dir(closes, 75),
        "sma200_dir": _sma_dir(closes, 200),
        "trend_score": score,
        "candles":    candles[-200:],
    }


async def fetch_technical(session: aiohttp.ClientSession) -> dict:
    """
    BTC 1H/4H/1D/1W の OHLCV を取得し、SMA20/75/200 + RSI14 を計算。
    composite_score: (1h×1 + 4h×2 + 1d×3 + 1w×4) / 10 の加重平均
    signal: BULL(>0.5) / BEAR(<-0.5) / NEUTRAL
    """
    intervals = {"1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w"}
    tasks = {
        tf: asyncio.create_task(_fetch_klines(session, iv, 250))
        for tf, iv in intervals.items()
    }

    tf_data = {}
    weights = {"1h": 1, "4h": 2, "1d": 3, "1w": 4}
    for tf, task in tasks.items():
        candles = await task
        tf_data[tf] = _build_tf_data(candles)

    # composite score (加重平均)
    total_w = 0
    weighted_sum = 0.0
    for tf, w in weights.items():
        score = tf_data.get(tf, {}).get("trend_score")
        if score is not None:
            weighted_sum += score * w
            total_w += w

    composite = round(weighted_sum / total_w, 3) if total_w else 0.0
    if composite > 0.5:
        signal = "BULL"
    elif composite < -0.5:
        signal = "BEAR"
    else:
        signal = "NEUTRAL"

    return {
        **tf_data,
        "composite_score": composite,
        "signal": signal,
    }


# ================================================================
# 清算水準マップ (Liquidation Heatmap)
# ================================================================

async def fetch_liq_heatmap(session: aiohttp.ClientSession, btc_price: float) -> dict:
    """
    清算が集中しそうな価格水準を複数ソースから推定。
    OKX 実清算イベント + OI × レバレッジ分布による推定清算クラスター。
    """
    result = {
        "okx_recent_liq": [],
        "liq_levels": [],
        "key_levels": {
            "major_long_liq_below":  None,
            "major_short_liq_above": None,
            "next_long_liq":  None,
            "next_short_liq": None,
        },
        "total_long_liq_est_usd":  0,
        "total_short_liq_est_usd": 0,
    }

    # 1. OKX 実清算イベント
    okx_task = asyncio.create_task(_get(
        session,
        "https://www.okx.com/api/v5/public/liquidation-orders",
        params={"instType": "SWAP", "uly": "BTC-USD", "state": "filled", "limit": "100"}))

    # 2. Binance BTC OI (USD)
    bn_oi_task = asyncio.create_task(_get(
        session,
        "https://fapi.binance.com/fapi/v1/openInterest",
        params={"symbol": "BTCUSDT"}))

    # 3. Binance account L/S ratio (BTC)
    bn_ls_task = asyncio.create_task(_get(
        session,
        "https://fapi.binance.com/futures/data/globalLongShortAccountRatio",
        params={"symbol": "BTCUSDT", "period": "1h", "limit": "1"}))

    # --- OKX 清算イベントを解析 ---
    okx_d = await okx_task
    okx_events = []
    if okx_d:
        try:
            for item in okx_d.get("data", []):
                for detail in item.get("details", []):
                    bk_px = float(detail.get("bkPx", 0) or 0)
                    sz    = float(detail.get("sz",   0) or 0)
                    side  = detail.get("side", "")   # buy=short清算, sell=long清算
                    ts    = int(detail.get("ts", 0) or 0)
                    if bk_px > 0 and sz > 0:
                        okx_events.append({
                            "price":    round(bk_px, 2),
                            "side":     "short" if side == "buy" else "long",
                            "size_btc": round(sz, 4),
                            "time_ms":  ts,
                        })
        except Exception as e:
            logger.warning("okx liq heatmap parse: %s", e)
    result["okx_recent_liq"] = okx_events[:50]  # 最新50件

    # --- Binance OI 取得 ---
    total_oi_usd = 8.1e9  # fallback
    bn_oi_d = await bn_oi_task
    if bn_oi_d and "openInterest" in bn_oi_d:
        try:
            oi_btc = float(bn_oi_d["openInterest"])
            total_oi_usd = oi_btc * btc_price
        except Exception:
            pass

    # --- L/S ratio から偏り係数を計算 ---
    long_bias = 0.5   # default: 50/50
    bn_ls_d = await bn_ls_task
    if bn_ls_d and isinstance(bn_ls_d, list) and bn_ls_d:
        try:
            long_bias = float(bn_ls_d[0].get("longAccount", 0.5))
        except Exception:
            pass
    short_bias = 1.0 - long_bias

    # --- レバレッジ分布に基づく清算水準推定 ---
    # 一般的なレバ分布: 5x(40%), 10x(30%), 20x(20%), 50x(10%)
    lev_dist = [(5, 0.4), (10, 0.3), (20, 0.2), (50, 0.1)]
    maint_margin = 0.9  # 維持証拠金率考慮係数

    liq_levels_raw = []
    total_long_est  = 0.0
    total_short_est = 0.0

    for lev, pct in lev_dist:
        liq_usd_total = total_oi_usd * pct

        # ロング清算水準 (価格下落で清算)
        liq_price_long  = btc_price * (1 - (1 / lev) * maint_margin)
        long_usd = liq_usd_total * long_bias
        total_long_est += long_usd

        # ショート清算水準 (価格上昇で清算)
        liq_price_short = btc_price * (1 + (1 / lev) * maint_margin)
        short_usd = liq_usd_total * short_bias
        total_short_est += short_usd

        long_btc  = long_usd  / btc_price if btc_price else 0
        short_btc = short_usd / btc_price if btc_price else 0

        liq_levels_raw.append({
            "price_level":    round(liq_price_long, 0),
            "long_liq_btc":   round(long_btc,  2),
            "short_liq_btc":  0.0,
            "lev":            lev,
        })
        liq_levels_raw.append({
            "price_level":    round(liq_price_short, 0),
            "long_liq_btc":   0.0,
            "short_liq_btc":  round(short_btc, 2),
            "lev":            lev,
        })

    # 価格でソートして整形
    liq_levels_raw.sort(key=lambda x: x["price_level"])
    liq_levels = []
    for lv in liq_levels_raw:
        liq_levels.append({
            "price_level":   lv["price_level"],
            "long_liq_btc":  lv["long_liq_btc"],
            "short_liq_btc": lv["short_liq_btc"],
        })
    result["liq_levels"] = liq_levels

    # --- key_levels 計算 ---
    below_levels = [lv for lv in liq_levels if lv["price_level"] < btc_price and lv["long_liq_btc"] > 0]
    above_levels = [lv for lv in liq_levels if lv["price_level"] > btc_price and lv["short_liq_btc"] > 0]

    below_sorted = sorted(below_levels, key=lambda x: -x["long_liq_btc"])
    above_sorted = sorted(above_levels, key=lambda x: -x["short_liq_btc"])
    below_by_price = sorted(below_levels, key=lambda x: -x["price_level"])  # 現在価格に最も近い
    above_by_price = sorted(above_levels, key=lambda x: x["price_level"])

    result["key_levels"] = {
        "major_long_liq_below":  below_sorted[0]["price_level"]  if below_sorted  else None,
        "major_short_liq_above": above_sorted[0]["price_level"]  if above_sorted  else None,
        "next_long_liq":         below_by_price[0]["price_level"] if below_by_price else None,
        "next_short_liq":        above_by_price[0]["price_level"] if above_by_price else None,
    }
    result["total_long_liq_est_usd"]  = round(total_long_est,  0)
    result["total_short_liq_est_usd"] = round(total_short_est, 0)

    return result


# ================================================================
# 変化率 (DB履歴比較)
# ================================================================

_CHANGE_FIELDS = {
    "btc_price":          lambda d: d.get("btc_price"),
    "btc_dominance":      lambda d: d.get("btc_dominance"),
    "dvol":               lambda d: (d.get("vol") or {}).get("dvol"),
    "fr_avg_btc":         lambda d: (d.get("fr_aggregate") or {}).get("BTC", {}).get("avg"),
    "etf_daily":          lambda d: (d.get("etf_flow") or {}).get("daily_total_musd"),
    "exchange_flow_net":  lambda d: (d.get("exchange_flow") or {}).get("net_usd"),
    "stablecoin_total":   lambda d: (d.get("stablecoins") or {}).get("total_usd"),
    "mempool_count":      lambda d: (d.get("mempool") or {}).get("count"),
    "oi_total_btc":       lambda d: (d.get("oi_total") or {}).get("BTC", {}).get("total_coin"),
    "coinbase_premium":   lambda d: d.get("coinbase_premium_pct"),
}

_TARGET_HOURS = {"24h_ago": 24, "7d_ago": 168, "30d_ago": 720}


def _find_closest(snapshots: list, target_hours: int) -> Optional[dict]:
    """snapshotsの中から now - target_hours に最も近いスナップショットを返す"""
    if not snapshots:
        return None
    now_ts = time.time()
    target_ts = now_ts - target_hours * 3600
    best = None
    best_diff = float("inf")
    for snap in snapshots:
        ts_str = snap.get("timestamp", "")
        try:
            dt = datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            diff = abs(dt.timestamp() - target_ts)
            if diff < best_diff:
                best_diff = diff
                best = snap
        except Exception:
            continue
    return best


async def _fetch_price_fallback(session: aiohttp.ClientSession) -> dict:
    """DBデータ不足時: Binance 1H OHLCV から価格変化率のみ計算"""
    try:
        candles = await _fetch_klines(session, "1h", 750)
        if not candles:
            return {}
        now_price = candles[-1]["c"]
        def _chg(hours):
            idx = len(candles) - 1 - hours
            if idx < 0:
                return None
            return round((now_price - candles[idx]["c"]) / candles[idx]["c"] * 100, 4)
        return {
            "btc_price": {
                "now": round(now_price, 2),
                "24h_ago": round(candles[max(0, len(candles)-25)]["c"], 2) if len(candles) > 24 else None,
                "7d_ago":  round(candles[max(0, len(candles)-169)]["c"], 2) if len(candles) > 168 else None,
                "30d_ago": round(candles[max(0, len(candles)-721)]["c"], 2) if len(candles) > 720 else None,
                "chg_24h": _chg(24),
                "chg_7d":  _chg(168),
                "chg_30d": _chg(720),
            }
        }
    except Exception as e:
        logger.warning("price fallback: %s", e)
        return {}


async def fetch_changes(session: aiohttp.ClientSession,
                        current: Optional[dict] = None,
                        db_path: str = "data/dashboard.db") -> dict:
    """
    DBの過去スナップショットと現在値を比較して変化率を計算。
    current: 現在のスナップショット dict (None の場合は DB 最新値を使用)
    """
    from db import get_history, get_latest, init_db

    try:
        init_db(db_path)
        snapshots = get_history(hours=750, db_path=db_path)
    except Exception as e:
        logger.warning("fetch_changes get_history failed: %s", e)
        snapshots = []

    # current が渡されていない場合は DB 最新値
    if current is None:
        try:
            current = get_latest(db_path=db_path)
        except Exception:
            current = {}
    if not current:
        current = {}

    # DBデータが少ない場合は Binance フォールバック
    if len(snapshots) < 2:
        logger.info("fetch_changes: DB has < 2 snapshots, using Binance fallback")
        return await _fetch_price_fallback(session)

    result = {}
    for field, extractor in _CHANGE_FIELDS.items():
        now_val = extractor(current)
        entry: dict = {"now": now_val}

        for label, hours in _TARGET_HOURS.items():
            snap = _find_closest(snapshots, hours)
            past_val = extractor(snap) if snap else None
            entry[label] = past_val

            chg_key = "chg_" + label.replace("_ago", "")
            if now_val is not None and past_val is not None and past_val != 0:
                entry[chg_key] = round((now_val - past_val) / abs(past_val) * 100, 4)
            else:
                entry[chg_key] = None

        result[field] = entry

    return result


# ================================================================
# メイン: collect_all()
# ================================================================

async def collect_all() -> dict:
    """
    全APIを並列取得してスナップショット dict を返す。
    目標実行時間: 8秒以内
    """
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    async with aiohttp.ClientSession(timeout=TIMEOUT) as session:
        # --- Step 1: btc_price を先取り (technical/liq_heatmap が依存するため) ---
        btc_price = await _fetch_btc_price(session)
        _price_for_heatmap = btc_price or 80000

        # --- Step 2: 全タスクを同時に起動 ---
        btc_dom_task      = asyncio.create_task(_fetch_btc_dominance(session))
        mempool_task      = asyncio.create_task(_fetch_mempool(session))
        fr_oi_task        = asyncio.create_task(_fetch_all_fr_oi(session, TOP15))
        vol_task          = asyncio.create_task(_fetch_vol(session))
        stable_task       = asyncio.create_task(_fetch_stablecoins(session))
        macro_task        = asyncio.create_task(_fetch_macro(session))
        etf_task          = asyncio.create_task(_fetch_etf_flow(session))
        exflow_task       = asyncio.create_task(_fetch_exchange_flow(session))
        poly_task         = asyncio.create_task(_fetch_polymarket(session))
        okx_liq_task      = asyncio.create_task(_fetch_okx_liquidations(session))
        bitmex_liq_task   = asyncio.create_task(_fetch_bitmex_liquidations(session))
        binance_liq_task  = asyncio.create_task(_fetch_binance_liquidations(session))
        bybit_liq_task    = asyncio.create_task(_fetch_bybit_liquidations(session))
        bn_ls_task        = asyncio.create_task(_fetch_bn_ls(session))
        technical_task    = asyncio.create_task(fetch_technical(session))
        liq_heatmap_task  = asyncio.create_task(fetch_liq_heatmap(session, _price_for_heatmap))

        # --- Step 3: 結果を回収 ---
        btc_dominance = await btc_dom_task

        # Coinbase premium は btc_price に依存
        cb_premium = await _fetch_coinbase_premium(session, btc_price)

        mempool        = await mempool_task
        fr_oi_raw      = await fr_oi_task
        vol            = await vol_task
        stablecoins    = await stable_task
        macro          = await macro_task
        etf_flow       = await etf_task
        exchange_flow  = await exflow_task
        polymarket     = await poly_task
        long_liq, short_liq       = await okx_liq_task
        bm_long, bm_short, bm_cnt, bm_events = await bitmex_liq_task
        bn_long, bn_short, bn_events          = await binance_liq_task
        bb_long, bb_short, bb_events          = await bybit_liq_task
        bn_taker, bn_acct, bn_top = await bn_ls_task
        technical_data = await technical_task
        liq_heatmap_data = await liq_heatmap_task

    # --- 集計 ---
    funding_rates = _build_funding_rates(fr_oi_raw)
    fr_aggregate  = _build_fr_aggregate(fr_oi_raw)
    open_interest = _build_open_interest(fr_oi_raw)
    oi_total      = _build_oi_total(fr_oi_raw)

    # 現在スナップショット (変化率計算用)
    current_snap = {
        "timestamp":           ts,
        "btc_price":           btc_price,
        "btc_dominance":       btc_dominance,
        "vol":                 vol,
        "fr_aggregate":        fr_aggregate,
        "etf_flow":            etf_flow,
        "exchange_flow":       exchange_flow,
        "stablecoins":         stablecoins,
        "mempool":             mempool,
        "oi_total":            oi_total,
        "coinbase_premium_pct": cb_premium,
    }

    # fetch_changes は DB アクセスを含むため gather 外でシリアル実行
    async with aiohttp.ClientSession(timeout=TIMEOUT) as _session2:
        changes_data = await fetch_changes(_session2, current=current_snap)

    return {
        "timestamp":            ts,
        "btc_price":            btc_price,
        "btc_dominance":        btc_dominance,
        "mempool":              mempool,
        "coinbase_premium_pct": cb_premium,
        "funding_rates":        funding_rates,
        "fr_aggregate":         fr_aggregate,
        "open_interest":        open_interest,
        "oi_total":             oi_total,
        "vol":                  vol,
        "stablecoins":          stablecoins,
        "macro":                macro,
        "etf_flow":             etf_flow,
        "exchange_flow":        exchange_flow,
        "polymarket":           polymarket,
        "liquidations": {
            "okx_long_liq_btc":      round(long_liq, 4),
            "okx_short_liq_btc":     round(short_liq, 4),
            "binance_long_liq_btc":  round(bn_long,   4),
            "binance_short_liq_btc": round(bn_short,  4),
            "bybit_long_liq_btc":    round(bb_long,   4),
            "bybit_short_liq_btc":   round(bb_short,  4),
            "bitmex_long_liq_btc":   round(bm_long,   4),
            "bitmex_short_liq_btc":  round(bm_short,  4),
            "bitmex_liq_count_1h":   bm_cnt,
            "bn_taker_ls":           bn_taker,
            "bn_account_ls":         bn_acct,
            "bn_top_ls":             bn_top,
        },
        "technical":    technical_data,
        "liq_heatmap":  {
            **liq_heatmap_data,
            # 全取引所の清算イベントをマージ (清算MAPオーバーレイ用)
            "all_exchange_liq": (
                [{"exchange": "okx", **e} for e in liq_heatmap_data.get("okx_recent_liq", [])]
                + bn_events + bb_events + bm_events
            )[:100],
        },
        "changes":      changes_data,
    }
