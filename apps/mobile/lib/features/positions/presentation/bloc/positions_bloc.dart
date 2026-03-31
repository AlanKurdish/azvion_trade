import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../data/positions_datasource.dart';

abstract class PositionsEvent extends Equatable {
  @override
  List<Object?> get props => [];
}
class LoadOpenPositions extends PositionsEvent {}
class LoadHistory extends PositionsEvent {
  final int page;
  LoadHistory({this.page = 1});
}

abstract class PositionsState extends Equatable {
  @override
  List<Object?> get props => [];
}
class PositionsInitial extends PositionsState {}
class PositionsLoading extends PositionsState {}
class OpenPositionsLoaded extends PositionsState {
  final List<dynamic> positions;
  OpenPositionsLoaded(this.positions);
  @override
  List<Object?> get props => [positions];
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

class PositionsBloc extends Bloc<PositionsEvent, PositionsState> {
  final PositionsDatasource _datasource;

  PositionsBloc(this._datasource) : super(PositionsInitial()) {
    on<LoadOpenPositions>((event, emit) async {
      emit(PositionsLoading());
      try {
        final positions = await _datasource.getOpenPositions();
        emit(OpenPositionsLoaded(positions));
      } catch (e) {
        emit(PositionsError(e.toString()));
      }
    });

    on<LoadHistory>((event, emit) async {
      emit(PositionsLoading());
      try {
        final data = await _datasource.getHistory(page: event.page);
        emit(HistoryLoaded(
          trades: data['trades'],
          total: data['total'],
          page: data['page'],
        ));
      } catch (e) {
        emit(PositionsError(e.toString()));
      }
    });
  }
}
