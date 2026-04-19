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
  final List<dynamic> categories;
  SymbolsLoaded(this.symbols, {this.categories = const []});
  @override
  List<Object?> get props => [symbols, categories];
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
        final results = await Future.wait([
          _datasource.getSymbols(),
          _datasource.getCategories(),
        ]);
        emit(SymbolsLoaded(results[0], categories: results[1]));
      } catch (e) {
        emit(SymbolsError(e.toString()));
      }
    });
  }
}
