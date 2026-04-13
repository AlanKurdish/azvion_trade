import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../data/trade_datasource.dart';
import '../../../../core/network/websocket_client.dart';

// --- Helper to extract readable error from Dio ---
String _extractError(Object e) {
  if (e is DioException) {
    final data = e.response?.data;
    if (data is Map<String, dynamic>) {
      final msg = data['message'];
      if (msg is String) return msg;
      if (msg is List) return msg.join(', ');
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Connection timed out. Please try again.';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Cannot connect to server. Check your internet connection.';
    }
    return e.message ?? 'Network error occurred';
  }
  return e.toString();
}

// --- Events ---
abstract class TradeEvent extends Equatable {
  @override
  List<Object?> get props => [];
}

class LoadOpenTrades extends TradeEvent {
  final String symbolId;
  LoadOpenTrades(this.symbolId);
  @override
  List<Object?> get props => [symbolId];
}

class OpenTradeRequested extends TradeEvent {
  final String symbolId;
  OpenTradeRequested(this.symbolId);
  @override
  List<Object?> get props => [symbolId];
}

class CloseTradeRequested extends TradeEvent {
  final String tradeId;
  CloseTradeRequested(this.tradeId);
  @override
  List<Object?> get props => [tradeId];
}

class TradePnlUpdated extends TradeEvent {
  final Map<String, dynamic> data;
  TradePnlUpdated(this.data);
}

class PriceUpdated extends TradeEvent {
  final double? bid;
  final double? ask;
  final double? formulaPrice;
  PriceUpdated({this.bid, this.ask, this.formulaPrice});
}

// --- States ---
abstract class TradeState extends Equatable {
  @override
  List<Object?> get props => [];
}

class TradeInitial extends TradeState {}

class TradeLoading extends TradeState {}

class TradeReady extends TradeState {
  final List<Map<String, dynamic>> openTrades;
  final double? liveBid;
  final double? liveAsk;
  final double? liveFormulaPrice;
  final bool isBuying;
  final String? successMessage;
  final String? errorMessage;
  final Map<String, Map<String, double>> tradePnls;

  TradeReady({
    required this.openTrades,
    this.liveBid,
    this.liveAsk,
    this.liveFormulaPrice,
    this.isBuying = false,
    this.successMessage,
    this.errorMessage,
    this.tradePnls = const {},
  });

  TradeReady copyWith({
    List<Map<String, dynamic>>? openTrades,
    double? liveBid,
    double? liveAsk,
    double? liveFormulaPrice,
    bool? isBuying,
    String? successMessage,
    String? errorMessage,
    Map<String, Map<String, double>>? tradePnls,
  }) {
    return TradeReady(
      openTrades: openTrades ?? this.openTrades,
      liveBid: liveBid ?? this.liveBid,
      liveAsk: liveAsk ?? this.liveAsk,
      liveFormulaPrice: liveFormulaPrice ?? this.liveFormulaPrice,
      isBuying: isBuying ?? this.isBuying,
      successMessage: successMessage,
      errorMessage: errorMessage,
      tradePnls: tradePnls ?? this.tradePnls,
    );
  }

  @override
  List<Object?> get props => [openTrades, liveBid, liveAsk, liveFormulaPrice, isBuying, successMessage, errorMessage, tradePnls];
}

// --- Bloc ---
class TradeBloc extends Bloc<TradeEvent, TradeState> {
  final TradeDatasource _datasource;
  final WebSocketClient _wsClient;
  StreamSubscription? _priceSub;
  StreamSubscription? _pnlSub;
  final Set<String> _subscribedTradeIds = {};

  TradeBloc(this._datasource, this._wsClient) : super(TradeInitial()) {
    on<LoadOpenTrades>(_onLoadOpenTrades);
    on<OpenTradeRequested>(_onOpen);
    on<CloseTradeRequested>(_onClose);
    on<PriceUpdated>(_onPriceUpdated);
    on<TradePnlUpdated>(_onPnlUpdate);
  }

  Future<void> _onLoadOpenTrades(LoadOpenTrades event, Emitter<TradeState> emit) async {
    emit(TradeLoading());
    try {
      final allOpenTrades = await _datasource.getOpenTrades();
      // Filter trades for this symbol
      final symbolTrades = allOpenTrades
          .where((t) => t['symbolId'] == event.symbolId)
          .map<Map<String, dynamic>>((t) => Map<String, dynamic>.from(t))
          .toList();

      // Subscribe to P&L updates for each open trade
      _subscribeToPnl(symbolTrades);

      emit(TradeReady(openTrades: symbolTrades));
    } catch (e) {
      emit(TradeReady(openTrades: const [], errorMessage: _extractError(e)));
    }
  }

  Future<void> _onOpen(OpenTradeRequested event, Emitter<TradeState> emit) async {
    final current = state is TradeReady ? state as TradeReady : TradeReady(openTrades: const []);
    emit(current.copyWith(isBuying: true));
    try {
      final trade = await _datasource.openTrade(event.symbolId);
      final newTrades = [...current.openTrades, trade];

      // Subscribe to this trade's P&L
      _subscribeTradeId(trade['id']);

      emit(TradeReady(
        openTrades: newTrades,
        liveBid: current.liveBid,
        liveAsk: current.liveAsk,
        liveFormulaPrice: current.liveFormulaPrice,
        tradePnls: current.tradePnls,
        successMessage: 'Trade opened successfully!',
      ));
    } catch (e) {
      emit(current.copyWith(
        isBuying: false,
        errorMessage: _extractError(e),
      ));
    }
  }

  Future<void> _onClose(CloseTradeRequested event, Emitter<TradeState> emit) async {
    final current = state is TradeReady ? state as TradeReady : TradeReady(openTrades: const []);
    try {
      await _datasource.closeTrade(event.tradeId);
      _wsClient.unsubscribeTrade(event.tradeId);
      _subscribedTradeIds.remove(event.tradeId);

      final updatedTrades = current.openTrades.where((t) => t['id'] != event.tradeId).toList();
      final updatedPnls = Map<String, Map<String, double>>.from(current.tradePnls)..remove(event.tradeId);

      emit(TradeReady(
        openTrades: updatedTrades,
        liveBid: current.liveBid,
        liveAsk: current.liveAsk,
        liveFormulaPrice: current.liveFormulaPrice,
        tradePnls: updatedPnls,
        successMessage: 'Trade closed successfully!',
      ));
    } catch (e) {
      emit(current.copyWith(errorMessage: _extractError(e)));
    }
  }

  void _onPriceUpdated(PriceUpdated event, Emitter<TradeState> emit) {
    if (state is TradeReady) {
      emit((state as TradeReady).copyWith(
        liveBid: event.bid,
        liveAsk: event.ask,
        liveFormulaPrice: event.formulaPrice,
      ));
    } else {
      emit(TradeReady(
        openTrades: const [],
        liveBid: event.bid,
        liveAsk: event.ask,
        liveFormulaPrice: event.formulaPrice,
      ));
    }
  }

  void _onPnlUpdate(TradePnlUpdated event, Emitter<TradeState> emit) {
    if (state is TradeReady) {
      final current = state as TradeReady;
      final tradeId = event.data['tradeId']?.toString();
      if (tradeId == null) return;

      final updatedPnls = Map<String, Map<String, double>>.from(current.tradePnls);
      updatedPnls[tradeId] = {
        'currentPrice': (event.data['currentPrice'] as num).toDouble(),
        'unrealizedPnl': (event.data['unrealizedPnl'] as num).toDouble(),
      };

      emit(current.copyWith(tradePnls: updatedPnls));
    }
  }

  String? _subscribedSymbolId;

  void subscribeToPriceStream(String mtSymbol, {String? symbolId}) {
    _priceSub?.cancel();
    _subscribedSymbolId = symbolId;
    _wsClient.subscribePrices([mtSymbol]);
    _priceSub = _wsClient.on('price:update').listen((data) {
      if (data is Map<String, dynamic> && data['symbol'] == mtSymbol) {
        // If symbolId is set, only accept prices for this specific symbol
        if (_subscribedSymbolId != null && data['symbolId'] != null) {
          if (data['symbolId'] != _subscribedSymbolId) return;
        }
        final formulaPrice = (data['formulaPrice'] as num?)?.toDouble();
        if (formulaPrice != null) {
          add(PriceUpdated(formulaPrice: formulaPrice));
        }
      }
    });
  }

  void unsubscribeFromPriceStream(String mtSymbol) {
    _priceSub?.cancel();
    _wsClient.unsubscribePrices([mtSymbol]);
  }

  void _subscribeToPnl(List<Map<String, dynamic>> trades) {
    _pnlSub?.cancel();
    _pnlSub = _wsClient.on('trade:pnl').listen((data) {
      if (data is Map<String, dynamic>) {
        add(TradePnlUpdated(data));
      }
    });

    for (final trade in trades) {
      _subscribeTradeId(trade['id']);
    }
  }

  void _subscribeTradeId(String tradeId) {
    if (!_subscribedTradeIds.contains(tradeId)) {
      _wsClient.subscribeTrade(tradeId);
      _subscribedTradeIds.add(tradeId);
    }
  }

  @override
  Future<void> close() {
    _priceSub?.cancel();
    _pnlSub?.cancel();
    for (final id in _subscribedTradeIds) {
      _wsClient.unsubscribeTrade(id);
    }
    return super.close();
  }
}
