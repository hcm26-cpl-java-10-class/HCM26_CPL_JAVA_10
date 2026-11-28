package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.upload.FileStorageService;
import org.springframework.stereotype.Service;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.Base64;
import java.util.Comparator;
import javax.imageio.ImageIO;

@Service
public class CourseCoverService {
    private final FileStorageService storage;
    public CourseCoverService(FileStorageService storage) { this.storage = storage; }

    public void ensureCover(Course course) {
        if (course.getCoverImage() != null && !course.getCoverImage().isBlank()) {
            String value = course.getCoverImage();
            if (value.length() > 2_800_000 || !value.matches("data:image/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+"))
                throw new BadRequestException("Select a PNG, JPEG, GIF or WebP image of 2 MB or smaller");
            byte[] bytes;
            try { bytes = Base64.getDecoder().decode(value.substring(value.indexOf(',')+1)); }
            catch (IllegalArgumentException e) { throw new BadRequestException("Invalid cover image"); }
            course.setThumbnailUrl(storage.storeCourseImage(bytes));
            course.setCoverImage(null);
        } else if (course.getThumbnailUrl() == null || course.getThumbnailUrl().isBlank()) {
            course.setThumbnailUrl(storage.storeCourseImage(render(course)));
        }
    }

    byte[] render(Course course) {
        BufferedImage image = new BufferedImage(1200, 630, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setColor(new Color(15,23,42)); g.fillRect(0,0,1200,630);
            g.setColor(new Color(51,65,85)); g.fillOval(800,-120,560,560);
            var category = course.getCategories() == null ? null : course.getCategories().stream()
                .sorted(Comparator.comparing(c -> c.getCode() == null ? "" : c.getCode())).findFirst().orElse(null);
            String label = category == null ? "Course" : category.getName();
            String icon = category == null ? "CM" : category.getCode();
            g.setColor(Color.WHITE); g.setFont(new Font("SansSerif",Font.BOLD,28));
            g.drawString(icon == null ? "CM" : icon.substring(0, Math.min(8,icon.length())), 70,100);
            g.setFont(new Font("SansSerif",Font.PLAIN,24));
            drawLines(g, label, 70,150,1040,30);
            String name = course.getName() == null ? "Untitled course" : course.getName();
            int size = 54;
            while (size > 28 && wrapped(g,name,new Font("SansSerif",Font.BOLD,size),1040).size() > 5) size -= 2;
            g.setFont(new Font("SansSerif",Font.BOLD,size));
            drawLines(g,name,70,250,1040,size+10);
            g.setFont(new Font("SansSerif",Font.PLAIN,26));
            String level = course.getLevel() == null ? "Level not specified" : switch(course.getLevel()) {
                case BEGINNER -> "Beginner"; case INTERMEDIATE -> "Intermediate"; case ADVANCED -> "Advanced";
            };
            g.drawString(level,70,580);
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            ImageIO.write(image,"png",bytes); return bytes.toByteArray();
        } catch (IOException e) { throw new IllegalStateException("Could not generate the course cover",e); }
        finally { g.dispose(); }
    }
    private static java.util.List<String> wrapped(Graphics2D g,String text,Font font,int width) {
        var lines = new java.util.ArrayList<String>(); StringBuilder line = new StringBuilder();
        var metrics = g.getFontMetrics(font);
        for (int cp : text.codePoints().toArray()) {
            String character = new String(Character.toChars(cp));
            if (!line.isEmpty() && metrics.stringWidth(line + character) > width) { lines.add(line.toString()); line.setLength(0); }
            line.append(character);
        }
        if (!line.isEmpty()) lines.add(line.toString()); return lines;
    }
    private static void drawLines(Graphics2D g,String text,int x,int y,int width,int spacing) {
        for (String line : wrapped(g,text,g.getFont(),width)) { g.drawString(line,x,y); y += spacing; }
    }
}
