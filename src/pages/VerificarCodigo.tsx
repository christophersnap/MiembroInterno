import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Search, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function VerificarCodigo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { logos } = useSettings();

  const [carnet, setCarnet] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorSearch, setErrorSearch] = useState('');

  // Auto-format carnet: CVS-1234-AB
  const handleCarnetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.startsWith('CVS')) {
      val = val.substring(3);
    }
    
    let formatted = 'CVS';
    if (val.length > 0) formatted += '-' + val.substring(0, 4);
    if (val.length > 4) formatted += '-' + val.substring(4, 6);
    
    setCarnet(formatted);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (carnet.length < 11) {
      setErrorSearch("El formato debe ser CVS-0000-AA");
      return;
    }

    setLoading(true);
    setErrorSearch('');

    try {
      // First quick check to see if it exists
      const { count, error } = await supabase
        .from('socorristas')
        .select('*', { count: 'exact', head: true })
        .eq('carnet', carnet);

      if (error || count === 0) {
        setErrorSearch("Carnet o elemento no encontrado en los registros.");
      } else {
        // Redirect to the verification page which already handles the loading of data and profile picture securely
        navigate(`/verificar/${carnet}`);
      }
    } catch (err: any) {
      setErrorSearch("Error al consultar el sistema.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
      <div className="flex-grow py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex justify-between items-center sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0">
          {user ? (
            <Link to="/" className="inline-flex items-center text-sm font-medium text-primary hover:text-primary-hover">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Volver al Sistema
            </Link>
          ) : (
            <div className="w-full flex justify-end">
              <Link to="/login" className="inline-flex items-center text-sm font-medium text-primary hover:text-primary-hover">
                Iniciar Sesión
              </Link>
            </div>
          )}
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center mb-8">
          {logos?.verificacion ? (
            <img src={logos.verificacion} alt="Logo Institucional" className="h-20 w-auto mx-auto mb-4 object-contain rounded p-1" />
          ) : (
            <ShieldCheck className="mx-auto h-16 w-16 text-primary" />
          )}
          <h1 className="text-3xl font-extrabold text-primary flex items-center justify-center mt-2">
            Verificación de Código
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Ingrese el código del carnet para consultar la validez del elemento en nuestros registros.
          </p>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-xl">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form onSubmit={handleSearch} className="space-y-6">
              <div>
                <label htmlFor="carnet" className="block text-sm font-medium text-gray-700">
                  Número de Carnet
                </label>
                <div className="mt-1">
                  <input
                    id="carnet"
                    name="carnet"
                    type="text"
                    required
                    maxLength={11}
                    value={carnet}
                    onChange={handleCarnetChange}
                    placeholder="CVS-0000-AA"
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary text-center text-xl tracking-widest uppercase"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500 text-center">Formato: CVS-0000-AA</p>
              </div>

              {errorSearch && (
                <div className="rounded-md bg-red-50 p-4 animate-in slide-in-from-top-2">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">{errorSearch}</h3>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading || carnet.length < 11}
                  className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Search className="h-5 w-5 mr-2" />
                      Consultar Código
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} Cruz Verde Salvadoreña</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
