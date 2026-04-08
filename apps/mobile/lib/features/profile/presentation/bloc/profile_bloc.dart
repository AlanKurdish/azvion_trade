import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../data/profile_datasource.dart';
import '../../../../core/network/websocket_client.dart';

abstract class ProfileEvent extends Equatable {
  @override
  List<Object?> get props => [];
}
class LoadProfile extends ProfileEvent {}
class UpdateProfile extends ProfileEvent {
  final String? firstName;
  final String? lastName;
  final String? language;
  UpdateProfile({this.firstName, this.lastName, this.language});
}

abstract class ProfileState extends Equatable {
  @override
  List<Object?> get props => [];
}
class ProfileInitial extends ProfileState {}
class ProfileLoading extends ProfileState {}
class ProfileLoaded extends ProfileState {
  final Map<String, dynamic> profile;
  ProfileLoaded(this.profile);
  @override
  List<Object?> get props => [profile];
}
class ProfileUpdated extends ProfileState {
  final Map<String, dynamic> profile;
  ProfileUpdated(this.profile);
}
class ProfileError extends ProfileState {
  final String message;
  ProfileError(this.message);
}

class ProfileBloc extends Bloc<ProfileEvent, ProfileState> {
  final ProfileDatasource _datasource;
  final WebSocketClient _wsClient;
  StreamSubscription? _balanceSub;

  ProfileBloc(this._datasource, this._wsClient) : super(ProfileInitial()) {
    on<LoadProfile>((event, emit) async {
      if (state is! ProfileLoaded && state is! ProfileUpdated) {
        emit(ProfileLoading());
      }
      try {
        final profile = await _datasource.getProfile();
        emit(ProfileLoaded(profile));
      } catch (e) {
        if (state is! ProfileLoaded) {
          emit(ProfileError(e.toString()));
        }
      }
    });

    on<UpdateProfile>((event, emit) async {
      emit(ProfileLoading());
      try {
        final profile = await _datasource.updateProfile(
          firstName: event.firstName,
          lastName: event.lastName,
          language: event.language,
        );
        emit(ProfileUpdated(profile));
      } catch (e) {
        emit(ProfileError(e.toString()));
      }
    });

    // Auto-refresh profile when balance changes
    _balanceSub = _wsClient.on('balance:updated').listen((_) {
      add(LoadProfile());
    });
  }

  @override
  Future<void> close() {
    _balanceSub?.cancel();
    return super.close();
  }
}
