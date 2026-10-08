// Silkroad: Convoy Wars istemcisi - tek exe.
//
// Oyunun tamami (index.html, src/, vendor/, content/) exe'nin icine gomulu bir zip olarak durur.
// Ilk acilista %LOCALAPPDATA%\SilkroadConvoyWars\oyun-<surum>-<ozet>\ altina acilir (her derleme bir kez),
// 127.0.0.1 uzerinde kucuk bir dosya sunucusu baslatilir ve oyun Microsoft Edge'in uygulama
// penceresinde (adres cubugu yok) acilir. Pencere kapaninca exe de kapanir.
//
// Cok oyunculu sunucu ayri bir programdir (server/server.py); oyunda Cok Oyunculu -> Sunucu
// adresi kutusuna arkadasin verdigi adres yazilir. Surumler birebir ayni olmazsa sunucu reddeder.
//
// Derleme: python tools/build_client.py (Windows'ta hazir gelen .NET Framework csc.exe ile).
// C# 5 (csc 4.x) ile uyumlu yazildi.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Management;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("Silkroad: Convoy Wars")]
[assembly: AssemblyProduct("Silkroad: Convoy Wars")]
[assembly: AssemblyDescription("Silkroad: Convoy Wars oyun istemcisi")]
[assembly: AssemblyVersion(BuildInfo.AssemblyVersion)]
[assembly: AssemblyFileVersion(BuildInfo.AssemblyVersion)]

static class Launcher
{
    const int BasePort = 47805;
    const string Title = "Silkroad: Convoy Wars";
    static string Root;
    static bool TestMode;   // --test: tarayici gorunmez ve sessiz (otomatik deneme)

    static readonly Dictionary<string, string> Mime = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        { ".html", "text/html; charset=utf-8" }, { ".js", "text/javascript" }, { ".mjs", "text/javascript" },
        { ".json", "application/json" }, { ".css", "text/css" }, { ".png", "image/png" }, { ".jpg", "image/jpeg" },
        { ".jpeg", "image/jpeg" }, { ".svg", "image/svg+xml" }, { ".wasm", "application/wasm" }, { ".ico", "image/x-icon" },
        { ".bin", "application/octet-stream" }, { ".ogg", "audio/ogg" }, { ".wav", "audio/wav" }, { ".txt", "text/plain; charset=utf-8" },
    };

    [STAThread]
    static int Main(string[] args)
    {
        try
        {
            bool serveOnly = Array.IndexOf(args, "--serve-only") >= 0;   // yalniz dosya sunucusu (deneme)
            TestMode = Array.IndexOf(args, "--test") >= 0;
            string baseDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SilkroadConvoyWars");
            Directory.CreateDirectory(baseDir);
            string profile = Path.Combine(baseDir, "tarayici");

            // ayni surum zaten aciksa: yalniz yeni bir pencere ac
            for (int port = BasePort; port < BasePort + 10; port++)
            {
                string v = Probe(port);
                if (v == BuildInfo.Version) { OpenBrowser("http://127.0.0.1:" + port + "/", profile); return 0; }
            }

            Root = Path.Combine(baseDir, "oyun-" + BuildInfo.Version + "-" + BuildInfo.Hash);
            Extract(baseDir);
            TcpListener listener = Listen();
            int myPort = ((IPEndPoint)listener.LocalEndpoint).Port;
            Thread t = new Thread(delegate () { Serve(listener); });
            t.IsBackground = true;
            t.Start();
            string url = "http://127.0.0.1:" + myPort + "/";
            if (serveOnly) { Thread.Sleep(Timeout.Infinite); return 0; }
            Process p = OpenBrowser(url, profile);
            if (p == null)
            {
                MessageBox.Show("Oyun varsayılan tarayıcında açıldı:\n" + url + "\n\nOyunu kapatınca bu pencerede Tamam'a bas.", Title,
                    MessageBoxButtons.OK, MessageBoxIcon.Information);
                return 0;
            }
            WaitBrowser(p, profile);
            return 0;
        }
        catch (Exception e)
        {
            MessageBox.Show("Oyun başlatılamadı:\n\n" + e.Message, Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    // ------------------------------------------------------------ oyun dosyalari

    static void Extract(string baseDir)
    {
        string ok = Path.Combine(Root, ".tamam");
        if (File.Exists(ok)) return;
        string tmp = Root + ".yeni";
        if (Directory.Exists(tmp)) Directory.Delete(tmp, true);
        if (Directory.Exists(Root)) Directory.Delete(Root, true);
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("oyun.zip"))
        {
            if (s == null) throw new Exception("Oyun dosyaları exe içinde bulunamadı.");
            using (ZipArchive zip = new ZipArchive(s, ZipArchiveMode.Read))
            {
                string full = Path.GetFullPath(tmp) + Path.DirectorySeparatorChar;
                foreach (ZipArchiveEntry e in zip.Entries)
                {
                    string dest = Path.GetFullPath(Path.Combine(tmp, e.FullName));
                    if (!dest.StartsWith(full, StringComparison.OrdinalIgnoreCase)) continue;
                    if (e.FullName.EndsWith("/")) { Directory.CreateDirectory(dest); continue; }
                    Directory.CreateDirectory(Path.GetDirectoryName(dest));
                    e.ExtractToFile(dest, true);
                }
            }
        }
        File.WriteAllText(Path.Combine(tmp, ".tamam"), BuildInfo.Version);
        Directory.Move(tmp, Root);
        // eski surumlerin dosyalari
        foreach (string d in Directory.GetDirectories(baseDir, "oyun-*"))
        {
            if (string.Equals(Path.GetFullPath(d), Path.GetFullPath(Root), StringComparison.OrdinalIgnoreCase)) continue;
            try { Directory.Delete(d, true); } catch { }
        }
    }

    // ------------------------------------------------------------ yerel dosya sunucusu

    static string Probe(int port)
    {
        try
        {
            HttpWebRequest r = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/__silkroad");
            r.Timeout = 600;
            r.Proxy = null;
            using (WebResponse resp = r.GetResponse())
            using (StreamReader sr = new StreamReader(resp.GetResponseStream()))
                return sr.ReadToEnd().Trim();
        }
        catch { return null; }
    }

    // sabit port: tarayici kayitlari (ayarlar, en iyi sureler) adrese bagli, her acilista ayni kalsin
    static TcpListener Listen()
    {
        for (int port = BasePort; port < BasePort + 10; port++)
        {
            try
            {
                TcpListener l = new TcpListener(IPAddress.Loopback, port);
                l.Start();
                return l;
            }
            catch (SocketException) { }
        }
        TcpListener any = new TcpListener(IPAddress.Loopback, 0);
        any.Start();
        return any;
    }

    static void Serve(TcpListener l)
    {
        while (true)
        {
            TcpClient c = l.AcceptTcpClient();
            ThreadPool.QueueUserWorkItem(Handle, c);
        }
    }

    static string ReadHead(Stream s)
    {
        StringBuilder sb = new StringBuilder();
        int state = 0;
        while (sb.Length < 16384)
        {
            int b = s.ReadByte();
            if (b < 0) return null;
            sb.Append((char)b);
            if (b == '\r' && (state == 0 || state == 2)) state++;
            else if (b == '\n' && (state == 1 || state == 3)) { state++; if (state == 4) return sb.ToString(); }
            else state = 0;
        }
        return null;
    }

    static void Handle(object o)
    {
        TcpClient c = (TcpClient)o;
        try
        {
            c.NoDelay = true;
            using (NetworkStream s = c.GetStream())
            {
                s.ReadTimeout = 15000;
                while (true)
                {
                    string head = ReadHead(s);
                    if (head == null) return;
                    string[] lines = head.Split(new string[] { "\r\n" }, StringSplitOptions.None);
                    string[] req = lines[0].Split(' ');
                    if (req.Length < 2) return;
                    bool keep = head.IndexOf("connection: close", StringComparison.OrdinalIgnoreCase) < 0;
                    bool headOnly = req[0] == "HEAD";
                    if (req[0] != "GET" && !headOnly) { Send(s, 405, "text/plain", Encoding.UTF8.GetBytes("405"), null, headOnly, false); return; }
                    string path = req[1];
                    int q = path.IndexOfAny(new char[] { '?', '#' });
                    if (q >= 0) path = path.Substring(0, q);
                    path = Uri.UnescapeDataString(path);
                    if (path == "/__silkroad") { Send(s, 200, "text/plain", Encoding.UTF8.GetBytes(BuildInfo.Version), null, headOnly, keep); }
                    else
                    {
                        if (path == "/") path = "/index.html";
                        string full = Path.GetFullPath(Path.Combine(Root, path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar)));
                        bool inside = full.StartsWith(Path.GetFullPath(Root) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
                        if (!inside || !File.Exists(full) || Path.GetFileName(full).StartsWith("."))
                            Send(s, 404, "text/plain", Encoding.UTF8.GetBytes("404"), null, headOnly, keep);
                        else
                        {
                            string ct;
                            if (!Mime.TryGetValue(Path.GetExtension(full), out ct)) ct = "application/octet-stream";
                            Send(s, 200, ct, null, full, headOnly, keep);
                        }
                    }
                    if (!keep) return;
                }
            }
        }
        catch { }
        finally { try { c.Close(); } catch { } }
    }

    static void Send(Stream s, int code, string ctype, byte[] body, string file, bool headOnly, bool keep)
    {
        long len = body != null ? body.Length : new FileInfo(file).Length;
        string status = code == 200 ? "OK" : code == 404 ? "Not Found" : "Method Not Allowed";
        string h = "HTTP/1.1 " + code + " " + status + "\r\nContent-Type: " + ctype + "\r\nContent-Length: " + len +
                   "\r\nCache-Control: no-cache\r\nConnection: " + (keep ? "keep-alive" : "close") + "\r\n\r\n";
        byte[] hb = Encoding.ASCII.GetBytes(h);
        s.Write(hb, 0, hb.Length);
        if (headOnly) return;
        if (body != null) { s.Write(body, 0, body.Length); return; }
        using (FileStream f = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
            f.CopyTo(s, 65536);
    }

    // ------------------------------------------------------------ tarayici penceresi

    static string FindBrowser()
    {
        string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] cands = {
            Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe"),
        };
        foreach (string c in cands) if (File.Exists(c)) return c;
        return null;
    }

    static Process OpenBrowser(string url, string profile)
    {
        string exe = FindBrowser();
        if (exe == null) { Process.Start(url); return null; }
        string args = "--app=" + url + " --user-data-dir=\"" + profile + "\" --no-first-run --no-default-browser-check" +
                      " --disable-sync --start-maximized --autoplay-policy=no-user-gesture-required" +
                      (TestMode ? " --headless=new --mute-audio" : "");
        ProcessStartInfo psi = new ProcessStartInfo(exe, args);
        psi.UseShellExecute = false;
        return Process.Start(psi);
    }

    // tarayici kendi profiliyle acik oldugu surece sunucu calisir (ilk surec devredip kapanabilir)
    static void WaitBrowser(Process p, string profile)
    {
        DateTime t0 = DateTime.Now;
        string needle = profile.ToLowerInvariant();
        while (true)
        {
            Thread.Sleep(2000);
            if ((DateTime.Now - t0).TotalSeconds < 8) continue;
            int alive = BrowserAlive(needle);
            if (alive == 0) return;
            if (alive < 0) { p.WaitForExit(); return; }   // surec listesi okunamadi: ilk surecle yetin
        }
    }

    /** 1: profil acik, 0: kapali, -1: bilinmiyor. */
    static int BrowserAlive(string needle)
    {
        try
        {
            using (ManagementObjectSearcher q = new ManagementObjectSearcher(
                "SELECT CommandLine FROM Win32_Process WHERE Name='msedge.exe' OR Name='chrome.exe'"))
            {
                foreach (ManagementObject m in q.Get())
                {
                    object cl = m["CommandLine"];
                    if (cl != null && cl.ToString().ToLowerInvariant().Contains(needle)) return 1;
                }
            }
            return 0;
        }
        catch { return -1; }
    }
}
