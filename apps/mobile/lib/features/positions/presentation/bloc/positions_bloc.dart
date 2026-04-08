import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../data/positions_datasource.dart';
import '../../../../core/network/websocket_client.dart';

// Events
abstract class PositionsEvent extends Equatable {
  @override
  List<Object?> get props => [];
}

class LoadOpenPositions extends PositionsEvent {}

class LoadHistory extends PositionsEvent {
  final int page;
  LoadHistory({this.page = 1});
}

class ClosePositionRequested extends PositionsEvent {
  final String tradeId;
  ClosePositionRequested(this.tradeId);
}

class _PnlUpdated extends PositionsEvent {
  final Map<String, dynamic> data;
  _PnlUpdated(this.data);
}

class _PriceUpdated extends PositionsEvent {
  final Map<String, dynamic> data;
  _PriceUpdated(this.data);
}

// States
abstract class PositionsState extends Equatable {
  @override
  List<Object?> get props => [];
}

class PositionsInitial extends PositionsState {}

class PositionsLoading extends PositionsState {}

class OpenPositionsLoaded extends PositionsState {
  final List<dynamic> positions;
  final Map<String, Map<String, dynamic>> livePnl; // tradeId -> pnl data
  final Map<String, Map<String, dynamic>> livePrices; // mtSymbol -> price data
  final String? closingTradeId;

  OpenPositionsLoaded({
    required this.positions,
    this.livePnl = const {},
    this.livePrices = const {},
    this.closingTradeId,
  });

  OpenPositionsLoaded copyWith({
    List<dynamic>? positions,
    Map<String, Map<String, dynamic>>? livePnl,
    Map<String, Map<String, dynamic>>? livePrices,
    String? closingTradeId,
  }) {
    return OpenPositionsLoaded(
      positions: positions ?? this.positions,
      livePnl: livePnl ?? this.livePnl,
      livePrices: livePrices ?? this.livePrices,
      closingTradeId: closingTradeId,
    );
  }

  @override
  List<Object?> get props => [positions, livePnl, livePrices, closingTradeId];
}

class HistoryLoaded extends PositionsState {
  final List<dynamic> trades;
  final int total;
  final int page;

  HistoryLoaded({required this.trades, required this.total, required this.page});

  @override
  List<Object?> get props => [trades, total, page];
}

class PositionsError extends PositionsState {
  final String message;
  PositionsError(this.message);
}

// Bloc
class PositionsBloc extends Bloc<PositionsEvent, PositionsState> {
  final PositionsDatasource _datasource;
  final WebSocketClient _wsClient;
  StreamSubscription? _pnlSub;
  StreamSubscription? _priceSub;
  StreamSubscription? _tradeOpenedSub;
  StreamSubscription? _tradeClosedSub;
  final Set<String> _subscribedTradeIds = {};
  final Set<String> _subscribedSymbols = {};

  PositionsBloc(this._datasource, this._wsClient) : super(PositionsInitial()) {
    on<LoadOpenPositions>(_onLoadOpen);
    on<LoadHistory>(_onLoadHistory);
    on<ClosePositionRequested>(_onClose);
    on<_PnlUpdated>(_onPnlUpdated);
    on<_PriceUpdated>(_onPriceUpdated);

    // Subscribe to WS events
    _pnlSub = _wsClient.on('trade:pnl').listen((data) {
      if (data is Map<String, dynamic>) {
        add(_PnlUpdated(data));
      }
    });
    _priceSub = _wsClient.on('price:update').listen((data) {
      if (data is Map<String, dynamic>) {
        add(_PriceUpdated(data));
      }
    });

    // Auto-reload when trades are opened or closed
    _tradeOpenedSub = _wsClient.on('trade:opened').listen((_) {
      add(LoadOpenPositions());
    });
    _tradeClosedSub = _wsClient.on('trade:closed').listen((_) {
      add(LoadOpenPositions());
    });
  }

  Future<void> _onLoadOpen(LoadOpenPositions event, Emitter<PositionsState> emit) async {
    // Keep existing pnl/price data if reloading
    final existingPnl = state is OpenPositionsLoaded ? (state as OpenPositionsLoaded).livePnl : <String, Map<String, dynamic>>{};
    final existingPrices = state is OpenPositionsLoaded ? (state as OpenPositionsLoaded).livePrices : <String, Map<String, dynamic>>{};

    if (state is! OpenPositionsLoaded) emit(PositionsLoading());

    try {
      final positions = await _datasource.getOpenPositions();

      // Subscribe to trade P&L for new trades
      for (final trade in positions) {
        final tradeId = trade['id']?.toString() ?? '';
        if (tradeId.isNotEmpty && !_subscribedTradeIds.contains(tradeId)) {
          _wsClient.subscribeTrade(tradeId);
          _subscribedTradeIds.add(tradeId);
        }
        // Subscribe to price for the symbol
        final mtSymbol = trade['symbol']?['mtSymbol']?.toString() ?? '';
        if (mtSymbol.isNotEmpty && !_subscribedSymbols.contains(mtSymbol)) {
          _wsClient.subscribePrices([mtSymbol]);
          _subscribedSymbols.add(mtSymbol);
        }
      }

      emit(OpenPositionsLoaded(
        positions: positions,
        livePnl: Map.from(existingPnl),
        livePrices: Map.from(existingPrices),
      ));
    } catch (e) {
      emit(PositionsError(e.toString()));
    }
  }

  Future<void> _onLoadHistory(LoadHistory event, Emitter<PositionsState> emit) async {
    emit(PositionsLoading());
    try {
      final data = await _datasource.getHistory(page: event.page);
      emit(HistoryLoaded(
        trades: (data['trades'] as List?) ?? [],
        total: (data['total'] as int?) ?? 0,
        page: (data['page'] as int?) ?? 1,
      ));
    } catch (e) {
      emit(PositionsError(e.toString()));
    }
  }

  Future<void> _onClose(ClosePositionRequested event, Emitter<PositionsState> emit) async {
    if (state is OpenPositionsLoaded) {
      final s = state as OpenPositionsLoaded;
      emit(s.copyWith(closingTradeId: event.tradeId));
      try {
        await _datasource.closeTrade(event.tradeId);
        // Unsubscribe from closed trade
        _wsClient.unsubscribeTrade(event.tradeId);
        _subscribedTradeIds.remove(event.tradeId);
        // Reload positions
        add(LoadOpenPositions());
      } catch (e) {
        emit(s.copyWith(closingTradeId: null));
      }
    }
  }

  void _onPnlUpdated(_PnlUpdated event, Emitter<PositionsState> emit) {
    if (state is OpenPositionsLoaded) {
      final s = state as OpenPositionsLoaded;
      final tradeId = event.data['tradeId']?.toString() ?? '';
      if (tradeId.isEmpty) return;
      final updated = Map<String, Map<String, dynamic>>.from(s.livePnl);
      updated[tradeId] = event.data;
      emit(s.copyWith(livePnl: updated));
    }
  }

  void _onPriceUpdated(_PriceUpdated event, Emitter<PositionsState> emit) {
    if (state is OpenPositionsLoaded) {
      final s = state as OpenPositionsLoaded;
      final symbol = event.data['symbol']?.toString() ?? '';
      if (symbol.isEmpty) return;
      final updated = Map<String, Map<String, dynamic>>.from(s.livePrices);
      updated[symbol] = event.data;
      emit(s.copyWith(livePrices: updated));
    }
  }

  @override
  Future<void> close() {
    _pnlSub?.cancel();
    _priceSub?.cancel();
    _tradeOpenedSub?.cancel();
    _tradeClosedSub?.cancel();
    for (final id in _subscribedTradeIds) {
      _wsClient.unsubscribeTrade(id);
    }
    if (_subscribedSymbols.isNotEmpty) {
      _wsClient.unsubscribePrices(_subscribedSymbols.toList());
    }
    return super.close();
  }
}
