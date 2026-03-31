"""
MT5 Bridge - Python microservice that connects directly to MetaTrader 5
Exposes REST API + WebSocket for the NestJS backend
Streams both prices AND position updates to connected clients
"""
import asyncio
import json
import time
from contextlib import asynccontextmanager
from typing import Optional

import MetaTrader5 as mt5
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# --- Models ---
class TradeOpenRequest(BaseModel):
    symbol: str
    lot: float
    type: str  # "buy" or "sell"
    request_id: Optional[str] = None
    comment: Optional[str] = None


class TradeCloseRequest(BaseModel):
    position_id: int
    request_id: Optional[str] = None


# --- State ---
connected = False
price_subscribers: list[WebSocket] = []
streaming_symbols: set[str] = set()
price_task: Optional[asyncio.Task] = None
position_task: Optional[asyncio.Task] = None

# Track which position tickets each WS client wants to monitor
position_subscribers: dict[WebSocket, set[str]] = {}


# --- MT5 Connection ---
def connect_mt5(login: int = None, password: str = None, server: str = None) -> dict:
    global connected

    if not mt5.initialize():
        return {"connected": False, "error": f"initialize() failed: {mt5.last_error()}"}

    if login and password and server:
        if not mt5.login(login, password=password, server=server):
            return {"connected": False, "error": f"login() failed: {mt5.last_error()}"}

    info = mt5.account_info()
    if info is None:
        return {"connected": False, "error": "No account info"}

    connected = True
    return {
        "connected": True,
        "login": info.login,
        "server": info.server,
        "balance": info.balance,
        "equity": info.equity,
        "name": info.name,
        "company": info.company,
    }


def disconnect_mt5():
    global connected
    mt5.shutdown()
    connected = False


# --- Price Streaming ---
async def stream_prices():
    while True:
        if not connected or not streaming_symbols or not price_subscribers:
            await asyncio.sleep(0.5)
            continue

        prices = []
        for symbol in list(streaming_symbols):
            tick = mt5.symbol_info_tick(symbol)
            if tick:
                prices.append({
                    "symbol": symbol,
                    "bid": tick.bid,
                    "ask": tick.ask,
                    "last": tick.last,
                    "time": tick.time,
                })

        if prices:
            msg = json.dumps({"type": "prices", "data": prices})
            dead = []
            for ws in price_subscribers:
                try:
                    await ws.send_text(msg)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                price_subscribers.remove(ws)

        await asyncio.sleep(0.3)


# --- Position Streaming ---
async def stream_positions():
    """Polls MT5 positions and sends real profit/status to subscribers."""
    while True:
        if not connected or not position_subscribers:
            await asyncio.sleep(1)
            continue

        # Collect all tracked tickets across all subscribers
        all_tracked = set()
        for tickets in position_subscribers.values():
            all_tracked.update(tickets)

        if not all_tracked:
            await asyncio.sleep(1)
            continue

        # Get all open positions from MT5
        all_positions = mt5.positions_get()
        pos_by_ticket = {}
        if all_positions:
            for p in all_positions:
                pos_by_ticket[str(p.ticket)] = {
                    "ticket": str(p.ticket),
                    "symbol": p.symbol,
                    "type": "BUY" if p.type == mt5.ORDER_TYPE_BUY else "SELL",
                    "volume": p.volume,
                    "open_price": p.price_open,
                    "current_price": p.price_current,
                    "profit": p.profit,
                    "swap": p.swap,
                    "status": "OPEN",
                }

        # Send to each subscriber
        dead = []
        for ws, tickets in position_subscribers.items():
            if not tickets:
                continue

            updates = []
            for ticket in tickets:
                if ticket in pos_by_ticket:
                    updates.append(pos_by_ticket[ticket])
                else:
                    # Position no longer open in MT5 — it was closed
                    updates.append({
                        "ticket": ticket,
                        "status": "CLOSED",
                    })

            if updates:
                try:
                    await ws.send_text(json.dumps({
                        "type": "positions",
                        "data": updates,
                    }))
                except Exception:
                    dead.append(ws)

        for ws in dead:
            position_subscribers.pop(ws, None)
            if ws in price_subscribers:
                price_subscribers.remove(ws)

        await asyncio.sleep(0.5)  # 2x per second


# --- App ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    global price_task, position_task
    result = connect_mt5()
    if result["connected"]:
        print(f"MT5 connected: login={result['login']} server={result['server']}")
    else:
        print(f"MT5 not connected (will retry on /connect): {result.get('error')}")

    price_task = asyncio.create_task(stream_prices())
    position_task = asyncio.create_task(stream_positions())

    yield

    if price_task:
        price_task.cancel()
    if position_task:
        position_task.cancel()
    disconnect_mt5()


app = FastAPI(title="Azin Forex MT5 Bridge", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- REST Endpoints ---

@app.get("/status")
def get_status():
    if not connected:
        return {"connected": False}
    info = mt5.account_info()
    if info is None:
        return {"connected": False}
    return {
        "connected": True,
        "login": info.login,
        "server": info.server,
        "balance": info.balance,
        "equity": info.equity,
    }


class ConnectRequest(BaseModel):
    login: int
    password: str
    server: str


@app.post("/connect")
def connect(req: ConnectRequest):
    result = connect_mt5(req.login, req.password, req.server)
    if not result["connected"]:
        raise HTTPException(400, result.get("error", "Connection failed"))
    return result


@app.post("/disconnect")
def disconnect():
    disconnect_mt5()
    return {"connected": False}


@app.get("/symbols")
def get_symbols():
    if not connected:
        raise HTTPException(503, "MT5 not connected")
    symbols = mt5.symbols_get()
    if symbols is None:
        return []
    return [
        {
            "symbol": s.name,
            "description": s.description,
            "digits": s.digits,
            "trade_mode": s.trade_mode,
            "visible": s.visible,
        }
        for s in symbols
    ]


@app.get("/price/{symbol}")
def get_price(symbol: str):
    if not connected:
        raise HTTPException(503, "MT5 not connected")
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        raise HTTPException(404, f"No price for {symbol}")
    return {
        "symbol": symbol,
        "bid": tick.bid,
        "ask": tick.ask,
        "last": tick.last,
        "time": tick.time,
    }


@app.post("/trade/open")
def open_trade(req: TradeOpenRequest):
    if not connected:
        raise HTTPException(503, "MT5 not connected")

    mt5.symbol_select(req.symbol, True)
    tick = mt5.symbol_info_tick(req.symbol)
    if tick is None:
        raise HTTPException(400, f"Cannot get price for {req.symbol}")

    price = tick.ask if req.type == "buy" else tick.bid
    order_type = mt5.ORDER_TYPE_BUY if req.type == "buy" else mt5.ORDER_TYPE_SELL

    # Sanitize comment: ASCII only, max 31 chars
    raw_comment = req.comment or "AzinFX"
    safe_comment = raw_comment.encode("ascii", "ignore").decode("ascii")[:31].strip() or "AzinFX"

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": req.symbol,
        "volume": float(req.lot),
        "type": order_type,
        "price": float(price),
        "deviation": 20,
        "magic": 123456,
        "comment": safe_comment,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    result = mt5.order_send(request)
    if result is None:
        raise HTTPException(500, f"order_send failed: {mt5.last_error()}")

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        raise HTTPException(400, f"Trade failed: {result.retcode} - {result.comment}")

    # Find the position ticket from the deal
    position_ticket = None
    if result.order:
        import time as _time
        _time.sleep(0.1)
        deals = mt5.history_deals_get(position=result.order)
        if deals and len(deals) > 0:
            position_ticket = deals[0].position_id
        else:
            positions = mt5.positions_get(symbol=req.symbol)
            if positions:
                for p in positions:
                    if req.request_id and req.request_id in (p.comment or ""):
                        position_ticket = p.ticket
                        break
                if position_ticket is None:
                    position_ticket = positions[-1].ticket

    return {
        "status": "OK",
        "request_id": req.request_id,
        "order_id": str(result.order),
        "position_id": str(position_ticket) if position_ticket else str(result.order),
        "open_price": result.price,
        "volume": result.volume,
    }


@app.post("/trade/close")
def close_trade(req: TradeCloseRequest):
    if not connected:
        raise HTTPException(503, "MT5 not connected")

    position = mt5.positions_get(ticket=req.position_id)
    if not position or len(position) == 0:
        raise HTTPException(404, f"Position {req.position_id} not found")

    pos = position[0]
    symbol = pos.symbol
    volume = pos.volume
    pos_type = pos.type
    mt5_profit = pos.profit  # Actual profit from MT5 before close

    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        raise HTTPException(400, f"Cannot get price for {symbol}")

    close_type = mt5.ORDER_TYPE_SELL if pos_type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
    price = tick.bid if pos_type == mt5.ORDER_TYPE_BUY else tick.ask

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": float(volume),
        "type": close_type,
        "position": req.position_id,
        "price": float(price),
        "deviation": 20,
        "magic": 123456,
        "comment": "close",
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    result = mt5.order_send(request)
    if result is None:
        raise HTTPException(500, f"order_send failed: {mt5.last_error()}")

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        raise HTTPException(400, f"Close failed: {result.retcode} - {result.comment}")

    return {
        "status": "OK",
        "request_id": req.request_id,
        "order_id": str(result.order),
        "close_price": result.price,
        "profit": mt5_profit,
    }


@app.get("/positions")
def get_positions():
    if not connected:
        raise HTTPException(503, "MT5 not connected")
    positions = mt5.positions_get()
    if positions is None:
        return []
    return [
        {
            "ticket": str(p.ticket),
            "symbol": p.symbol,
            "type": "BUY" if p.type == mt5.ORDER_TYPE_BUY else "SELL",
            "volume": p.volume,
            "open_price": p.price_open,
            "current_price": p.price_current,
            "profit": p.profit,
            "swap": p.swap,
            "comment": p.comment,
        }
        for p in positions
    ]


@app.get("/position/{ticket}")
def get_position(ticket: int):
    if not connected:
        raise HTTPException(503, "MT5 not connected")
    position = mt5.positions_get(ticket=ticket)
    if not position or len(position) == 0:
        raise HTTPException(404, f"Position {ticket} not found")
    p = position[0]
    return {
        "ticket": str(p.ticket),
        "symbol": p.symbol,
        "type": "BUY" if p.type == mt5.ORDER_TYPE_BUY else "SELL",
        "volume": p.volume,
        "open_price": p.price_open,
        "current_price": p.price_current,
        "profit": p.profit,
        "swap": p.swap,
        "comment": p.comment,
    }


@app.post("/subscribe/{symbol}")
def subscribe_symbol(symbol: str):
    mt5.symbol_select(symbol, True)
    streaming_symbols.add(symbol)
    return {"subscribed": symbol, "total": len(streaming_symbols)}


@app.post("/unsubscribe/{symbol}")
def unsubscribe_symbol(symbol: str):
    streaming_symbols.discard(symbol)
    return {"unsubscribed": symbol, "total": len(streaming_symbols)}


# --- WebSocket ---

@app.websocket("/ws/prices")
async def websocket_prices(ws: WebSocket):
    await ws.accept()
    price_subscribers.append(ws)
    position_subscribers[ws] = set()
    print(f"WS subscriber connected. Total: {len(price_subscribers)}")

    try:
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)

            if msg.get("action") == "subscribe":
                for sym in msg.get("symbols", []):
                    mt5.symbol_select(sym, True)
                    streaming_symbols.add(sym)
                await ws.send_text(json.dumps({
                    "type": "subscribed",
                    "symbols": list(streaming_symbols),
                }))

            elif msg.get("action") == "unsubscribe":
                for sym in msg.get("symbols", []):
                    streaming_symbols.discard(sym)

            elif msg.get("action") == "subscribe_positions":
                tickets = msg.get("tickets", [])
                position_subscribers[ws].update(str(t) for t in tickets)
                await ws.send_text(json.dumps({
                    "type": "positions_subscribed",
                    "tickets": list(position_subscribers[ws]),
                }))

            elif msg.get("action") == "unsubscribe_positions":
                tickets = msg.get("tickets", [])
                for t in tickets:
                    position_subscribers[ws].discard(str(t))

    except WebSocketDisconnect:
        pass
    finally:
        if ws in price_subscribers:
            price_subscribers.remove(ws)
        position_subscribers.pop(ws, None)
        print(f"WS subscriber disconnected. Total: {len(price_subscribers)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8010)
