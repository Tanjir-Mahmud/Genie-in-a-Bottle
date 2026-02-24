// Icon Generator for Genie in a Bottle
// Run with: dotnet script generate_icons.csx
// Or: dotnet run (if using a console app)

using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

var iconsDir = @"w:\Hackathon\Vera\LogiPlugin\AmbientRootPlugin\Assets\Icons";

var personas = new[] {
    ("creative_genie",     "#FFD700", "★"),  // Gold lamp star
    ("tech_lead",          "#00D4FF", "◆"),  // Cyan diamond
    ("smart_home_warden",  "#00FF88", "⬡"),  // Green hexagon
};

foreach (var (name, hex, symbol) in personas)
{
    var color = ColorTranslator.FromHtml(hex);
    
    // --- Normal Icon ---
    using (var bmp = new Bitmap(80, 80))
    using (var g = Graphics.FromImage(bmp))
    {
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAlias;
        g.Clear(ColorTranslator.FromHtml("#1a1a2e"));
        
        using var pen = new Pen(color, 2);
        g.DrawEllipse(pen, 10, 10, 60, 60);
        
        using var brush = new SolidBrush(color);
        using var font = new Font("Segoe UI Symbol", 24, FontStyle.Bold);
        var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        g.DrawString(symbol, font, brush, new RectangleF(0, 0, 80, 80), sf);
        
        bmp.Save(Path.Combine(iconsDir, $"{name}.png"), ImageFormat.Png);
        Console.WriteLine($"Created {name}.png");
    }
    
    // --- Active Icon (glow border) ---
    using (var bmp = new Bitmap(80, 80))
    using (var g = Graphics.FromImage(bmp))
    {
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAlias;
        g.Clear(ColorTranslator.FromHtml("#1a1a2e"));
        
        // Outer glow
        using var glowPen = new Pen(Color.FromArgb(80, color), 6);
        g.DrawEllipse(glowPen, 4, 4, 72, 72);
        
        // Inner ring
        using var pen = new Pen(color, 3);
        g.DrawEllipse(pen, 8, 8, 64, 64);
        
        using var brush = new SolidBrush(color);
        using var font = new Font("Segoe UI Symbol", 24, FontStyle.Bold);
        var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        g.DrawString(symbol, font, brush, new RectangleF(0, 0, 80, 80), sf);
        
        bmp.Save(Path.Combine(iconsDir, $"{name}_active.png"), ImageFormat.Png);
        Console.WriteLine($"Created {name}_active.png");
    }
}

// --- Status Ring Icon ---
using (var bmp = new Bitmap(80, 80))
using (var g = Graphics.FromImage(bmp))
{
    g.SmoothingMode = SmoothingMode.AntiAlias;
    g.Clear(ColorTranslator.FromHtml("#1a1a2e"));
    
    using var gradientBrush = new LinearGradientBrush(
        new Point(0, 0), new Point(80, 80),
        ColorTranslator.FromHtml("#FFD700"),
        ColorTranslator.FromHtml("#00FF88")
    );
    using var pen = new Pen(gradientBrush, 4);
    g.DrawEllipse(pen, 8, 8, 64, 64);
    
    // Center dot
    using var dotBrush = new SolidBrush(ColorTranslator.FromHtml("#00D4FF"));
    g.FillEllipse(dotBrush, 32, 32, 16, 16);
    
    bmp.Save(Path.Combine(iconsDir, "genie_status.png"), ImageFormat.Png);
    Console.WriteLine("Created genie_status.png");
}

Console.WriteLine("All icons generated!");
