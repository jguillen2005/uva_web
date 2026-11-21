// Instalador autoextraíble del Sistema UVA.
// build.ps1 lo compila con el csc.exe de .NET Framework (incluido en Windows) y le pega al final:
//   [zip con setup.ps1, payload.zip, imágenes...][8 bytes: largo del zip][8 bytes: "UVASFX01"]
// Al ejecutarse, extrae el zip a una carpeta temporal, corre setup.ps1 y la borra al terminar.
// C# 5 (sin interpolación de cadenas) para compilar con el csc de .NET Framework 4.x.
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Text;

[assembly: System.Reflection.AssemblyTitle("Instalador Sistema UVA")]
[assembly: System.Reflection.AssemblyProduct("Sistema UVA")]
[assembly: System.Reflection.AssemblyCompany("APInterfaces")]

namespace SistemaUva
{
    /// <summary>Vista de solo lectura de una porción de otro stream (el zip pegado al .exe).</summary>
    sealed class Porcion : Stream
    {
        private readonly Stream _base;
        private readonly long _inicio;
        private readonly long _largo;
        private long _pos;

        public Porcion(Stream b, long inicio, long largo) { _base = b; _inicio = inicio; _largo = largo; }
        public override bool CanRead { get { return true; } }
        public override bool CanSeek { get { return true; } }
        public override bool CanWrite { get { return false; } }
        public override long Length { get { return _largo; } }
        public override long Position { get { return _pos; } set { _pos = value; } }
        public override void Flush() { }
        public override void SetLength(long value) { throw new NotSupportedException(); }
        public override void Write(byte[] buffer, int offset, int count) { throw new NotSupportedException(); }

        public override long Seek(long offset, SeekOrigin origin)
        {
            long p = origin == SeekOrigin.Begin ? offset : origin == SeekOrigin.Current ? _pos + offset : _largo + offset;
            if (p < 0) throw new IOException("Posición inválida");
            _pos = p;
            return _pos;
        }

        public override int Read(byte[] buffer, int offset, int count)
        {
            long restante = _largo - _pos;
            if (restante <= 0) return 0;
            if (count > restante) count = (int)restante;
            _base.Position = _inicio + _pos;
            int n = _base.Read(buffer, offset, count);
            _pos += n;
            return n;
        }
    }

    static class Programa
    {
        const string Firma = "UVASFX01";

        static int Main(string[] args)
        {
            Console.Title = "Instalador Sistema UVA";
            // /extraer <carpeta>: solo descomprime (para revisar el contenido), sin instalar.
            bool soloExtraer = args.Length >= 2 && string.Equals(args[0], "/extraer", StringComparison.OrdinalIgnoreCase);
            string temp = soloExtraer
                ? Path.GetFullPath(args[1])
                : Path.Combine(Path.GetTempPath(), "SistemaUVA-instalador-" + Guid.NewGuid().ToString("N"));
            try
            {
                string exe = Process.GetCurrentProcess().MainModule.FileName;
                Console.WriteLine();
                Console.WriteLine("  Preparando el instalador del Sistema UVA...");
                using (FileStream fs = new FileStream(exe, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    byte[] cola = new byte[16];
                    fs.Seek(-16, SeekOrigin.End);
                    LeerCompleto(fs, cola);
                    if (Encoding.ASCII.GetString(cola, 8, 8) != Firma)
                        throw new InvalidDataException("El instalador está incompleto o dañado. Descárgalo de nuevo.");
                    long largo = BitConverter.ToInt64(cola, 0);
                    long inicio = fs.Length - 16 - largo;
                    using (ZipArchive zip = new ZipArchive(new Porcion(fs, inicio, largo), ZipArchiveMode.Read))
                    {
                        Directory.CreateDirectory(temp);
                        foreach (ZipArchiveEntry e in zip.Entries)
                        {
                            string destino = Path.GetFullPath(Path.Combine(temp, e.FullName));
                            if (!destino.StartsWith(temp, StringComparison.OrdinalIgnoreCase)) continue; // sin rutas fuera de temp
                            if (string.IsNullOrEmpty(e.Name)) { Directory.CreateDirectory(destino); continue; }
                            Directory.CreateDirectory(Path.GetDirectoryName(destino));
                            Console.WriteLine("    " + e.FullName + " (" + (e.Length / 1048576) + " MB)");
                            e.ExtractToFile(destino, true);
                        }
                    }
                }

                if (soloExtraer)
                {
                    Console.WriteLine("  Contenido extraído en " + temp);
                    return 0;
                }

                // Pasa los argumentos al asistente (p. ej. -Silencioso -Demo si -Destino C:\UVA).
                StringBuilder a = new StringBuilder();
                a.Append("-NoProfile -ExecutionPolicy Bypass -File \"").Append(Path.Combine(temp, "setup.ps1")).Append('"');
                foreach (string x in args) a.Append(" \"").Append(x.Replace("\"", "")).Append('"');
                string ps = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"WindowsPowerShell\v1.0\powershell.exe");
                ProcessStartInfo psi = new ProcessStartInfo(ps, a.ToString());
                psi.UseShellExecute = false;
                psi.WorkingDirectory = temp;
                // Ruta de este .exe: el asistente la usa para continuar solo después de reiniciar (p. ej. al instalar Docker).
                psi.EnvironmentVariables["UVA_INSTALADOR_EXE"] = exe;
                using (Process p = Process.Start(psi))
                {
                    p.WaitForExit();
                    return p.ExitCode;
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine();
                Console.WriteLine("  ERROR: " + ex.Message);
                Console.ResetColor();
                Console.WriteLine("  Presiona Enter para cerrar...");
                Console.ReadLine();
                return 1;
            }
            finally
            {
                try { if (!soloExtraer && Directory.Exists(temp)) Directory.Delete(temp, true); } catch { }
            }
        }

        static void LeerCompleto(Stream s, byte[] b)
        {
            int leido = 0;
            while (leido < b.Length)
            {
                int n = s.Read(b, leido, b.Length - leido);
                if (n == 0) throw new EndOfStreamException();
                leido += n;
            }
        }
    }
}
