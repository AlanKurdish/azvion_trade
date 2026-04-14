import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../bloc/auth_bloc.dart';
import '../../../../l10n/app_localizations.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: isDark
                ? [const Color(0xFF0a0e1a), const Color(0xFF0f1628), const Color(0xFF0a0e1a)]
                : [const Color(0xFFF8F9FA), const Color(0xFFFFFFFF), const Color(0xFFF8F9FA)],
          ),
        ),
        child: SafeArea(
          child: BlocListener<AuthBloc, AuthState>(
            listener: (context, state) {
              if (state is AuthError) {
                final t = AppLocalizations.of(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Row(
                      children: [
                        const Icon(Icons.info_outline, color: Color(0xFFD4AF37), size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            state.message.contains('Invalid credentials') || state.message.contains('Unauthorized')
                                ? t.tr('wrongCredentials')
                                : state.message,
                            style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                    backgroundColor: isDark ? const Color(0xFF1a1f2e) : Colors.white,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: BorderSide(color: isDark ? const Color(0xFF2a3040) : const Color(0xFFE0E0E0)),
                    ),
                    margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    duration: const Duration(seconds: 3),
                  ),
                );
              }
            },
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Logo
                      Image.asset(
                        'assets/logo.png',
                        width: 160,
                        height: 160,
                        fit: BoxFit.contain,
                      ),
                      const SizedBox(height: 8),
                      // Gold separator
                      Container(
                        width: 50,
                        height: 2,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Colors.transparent, Color(0xFFD4AF37), Colors.transparent],
                          ),
                          borderRadius: BorderRadius.circular(1),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        t.tr('login'),
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w300,
                          color: isDark ? const Color(0xFF8a8a9a) : const Color(0xFF6B7280),
                          letterSpacing: 2,
                        ),
                      ),
                      const SizedBox(height: 36),
                      // Phone field
                      TextFormField(
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                        decoration: InputDecoration(
                          labelText: t.tr('phoneNumber'),
                          labelStyle: TextStyle(color: isDark ? const Color(0xFF6b7280) : const Color(0xFF9CA3AF)),
                          prefixIcon: const Icon(Icons.phone, color: Color(0xFFD4AF37), size: 20),
                          filled: true,
                          fillColor: isDark ? const Color(0xFF1a1f2e) : const Color(0xFFF0F0F0),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: isDark ? const Color(0xFF2a3040) : const Color(0xFFE0E0E0)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: isDark ? const Color(0xFF2a3040) : const Color(0xFFE0E0E0)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFFD4AF37)),
                          ),
                        ),
                        validator: (v) => v == null || v.isEmpty ? t.tr('required') : null,
                      ),
                      const SizedBox(height: 16),
                      // Password field
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                        decoration: InputDecoration(
                          labelText: t.tr('password'),
                          labelStyle: TextStyle(color: isDark ? const Color(0xFF6b7280) : const Color(0xFF9CA3AF)),
                          prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFFD4AF37), size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword ? Icons.visibility_off : Icons.visibility,
                              color: isDark ? const Color(0xFF6b7280) : const Color(0xFF9CA3AF),
                              size: 20,
                            ),
                            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                          ),
                          filled: true,
                          fillColor: isDark ? const Color(0xFF1a1f2e) : const Color(0xFFF0F0F0),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: isDark ? const Color(0xFF2a3040) : const Color(0xFFE0E0E0)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: isDark ? const Color(0xFF2a3040) : const Color(0xFFE0E0E0)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFFD4AF37)),
                          ),
                        ),
                        validator: (v) =>
                            v == null || v.length < 6 ? t.tr('minChars') : null,
                      ),
                      const SizedBox(height: 28),
                      // Login button
                      BlocBuilder<AuthBloc, AuthState>(
                        builder: (context, state) {
                          return SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: ElevatedButton(
                              onPressed: state is AuthLoading
                                  ? null
                                  : () {
                                      if (_formKey.currentState!.validate()) {
                                        context.read<AuthBloc>().add(AuthLoginRequested(
                                              phone: _phoneController.text.trim(),
                                              password: _passwordController.text,
                                            ));
                                      }
                                    },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFD4AF37),
                                foregroundColor: Colors.black,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                elevation: 0,
                              ),
                              child: state is AuthLoading
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0a0e1a)),
                                    )
                                  : Text(
                                      t.tr('login'),
                                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1),
                                    ),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 40),
                      // Copyright
                      const Text(
                        'Powered by www.eaaktech.com',
                        style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFF4a4a5a),
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
