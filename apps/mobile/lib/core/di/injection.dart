import 'package:get_it/get_it.dart';
import '../network/api_client.dart';
import '../network/websocket_client.dart';
import '../../features/auth/data/datasources/auth_remote_datasource.dart';
import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/dashboard/data/dashboard_datasource.dart';
import '../../features/dashboard/presentation/bloc/dashboard_bloc.dart';
import '../../features/trade/data/trade_datasource.dart';
import '../../features/trade/presentation/bloc/symbols_bloc.dart';
import '../../features/trade/presentation/bloc/trade_bloc.dart';
import '../../features/positions/data/positions_datasource.dart';
import '../../features/positions/presentation/bloc/positions_bloc.dart';
import '../../features/profile/data/profile_datasource.dart';
import '../../features/profile/presentation/bloc/profile_bloc.dart';

final sl = GetIt.instance;

void initDependencies() {
  // Core
  sl.registerLazySingleton<ApiClient>(() => ApiClient());
  sl.registerLazySingleton<WebSocketClient>(() => WebSocketClient());

  // Auth
  sl.registerLazySingleton<AuthRemoteDatasource>(
    () => AuthRemoteDatasource(sl<ApiClient>()),
  );
  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(sl<AuthRemoteDatasource>()),
  );
  sl.registerFactory(() => AuthBloc(sl<AuthRepository>(), sl<WebSocketClient>()));

  // Dashboard
  sl.registerLazySingleton(() => DashboardDatasource(sl<ApiClient>()));
  sl.registerFactory(() => DashboardBloc(sl<DashboardDatasource>()));

  // Trade
  sl.registerLazySingleton(() => TradeDatasource(sl<ApiClient>()));
  sl.registerFactory(() => SymbolsBloc(sl<TradeDatasource>()));
  sl.registerFactory(() => TradeBloc(sl<TradeDatasource>(), sl<WebSocketClient>()));

  // Positions
  sl.registerLazySingleton(() => PositionsDatasource(sl<ApiClient>()));
  sl.registerFactory(() => PositionsBloc(sl<PositionsDatasource>()));

  // Profile
  sl.registerLazySingleton(() => ProfileDatasource(sl<ApiClient>()));
  sl.registerFactory(() => ProfileBloc(sl<ProfileDatasource>()));
}
