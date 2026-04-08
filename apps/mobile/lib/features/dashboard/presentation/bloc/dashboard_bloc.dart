import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../data/dashboard_datasource.dart';
import '../../../../core/network/websocket_client.dart';

// Events
abstract class DashboardEvent extends Equatable {
  @override
  List<Object?> get props => [];
}
class LoadDashboard extends DashboardEvent {}

// States
abstract class DashboardState extends Equatable {
  @override
  List<Object?> get props => [];
}
class DashboardInitial extends DashboardState {}
class DashboardLoading extends DashboardState {}
class DashboardLoaded extends DashboardState {
  final double monthlyPnl;
  final double balance;
  final int openTradesCount;
  final int closedTradesCount;
  final double monthlyCommission;

  DashboardLoaded({
    required this.monthlyPnl,
    required this.balance,
    required this.openTradesCount,
    required this.closedTradesCount,
    required this.monthlyCommission,
  });

  @override
  List<Object?> get props => [monthlyPnl, balance, openTradesCount, closedTradesCount];
}
class DashboardError extends DashboardState {
  final String message;
  DashboardError(this.message);
}

// Bloc
class DashboardBloc extends Bloc<DashboardEvent, DashboardState> {
  final DashboardDatasource _datasource;
  final WebSocketClient _wsClient;
  StreamSubscription? _balanceSub;
  StreamSubscription? _tradeOpenedSub;
  StreamSubscription? _tradeClosedSub;

  DashboardBloc(this._datasource, this._wsClient) : super(DashboardInitial()) {
    on<LoadDashboard>(_onLoad);

    // Auto-refresh when balance changes or trades open/close
    _balanceSub = _wsClient.on('balance:updated').listen((_) {
      add(LoadDashboard());
    });
    _tradeOpenedSub = _wsClient.on('trade:opened').listen((_) {
      add(LoadDashboard());
    });
    _tradeClosedSub = _wsClient.on('trade:closed').listen((_) {
      add(LoadDashboard());
    });
  }

  Future<void> _onLoad(LoadDashboard event, Emitter<DashboardState> emit) async {
    // Don't show loading spinner on auto-refresh if data already loaded
    if (state is! DashboardLoaded) {
      emit(DashboardLoading());
    }
    try {
      final data = await _datasource.getDashboard();
      emit(DashboardLoaded(
        monthlyPnl: (data['monthlyPnl'] as num).toDouble(),
        balance: (data['balance'] as num).toDouble(),
        openTradesCount: data['openTradesCount'] as int,
        closedTradesCount: data['closedTradesCount'] as int,
        monthlyCommission: (data['monthlyCommission'] as num).toDouble(),
      ));
    } catch (e) {
      if (state is! DashboardLoaded) {
        emit(DashboardError(e.toString()));
      }
    }
  }

  @override
  Future<void> close() {
    _balanceSub?.cancel();
    _tradeOpenedSub?.cancel();
    _tradeClosedSub?.cancel();
    return super.close();
  }
}
