import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../data/trade_datasource.dart';

abstract class SymbolsEvent extends Equatable {
  @override
  List<Object?> get props => [];
}
class LoadSymbols extends SymbolsEvent {}

abstract class SymbolsState extends Equatable {
  @override
  List<Object?> get props => [];
}
class SymbolsInitial extends SymbolsState {}
class SymbolsLoading extends SymbolsState {}
class SymbolsLoaded extends SymbolsState {
  final List<dynamic> symbols;
  SymbolsLoaded(this.symbols);
  @override
  List<Object?> get props => [symbols];
}
class SymbolsError extends SymbolsState {
  final String message;
  SymbolsError(this.message);
}

class SymbolsBloc extends Bloc<SymbolsEvent, SymbolsState> {
  final TradeDatasource _datasource;

  SymbolsBloc(this._datasource) : super(SymbolsInitial()) {
    on<LoadSymbols>((event, emit) async {
      emit(SymbolsLoading());
      try {
        final symbols = await _datasource.getSymbols();
        emit(SymbolsLoaded(symbols));
      } catch (e) {
        emit(SymbolsError(e.toString()));
      }
    });
  }
}
