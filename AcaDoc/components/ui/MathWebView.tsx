import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface MathWebViewProps {
  latex: string;
  display?: boolean;
  color?: string;
  fontSize?: number;
}

export function MathWebView({ 
  latex, 
  display = false, 
  color = '#2c2a26', 
  fontSize = 15 
}: MathWebViewProps) {
  
  const htmlContent = useMemo(() => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.css" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.js"></script>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: transparent !important;
            display: flex;
            justify-content: ${display ? 'center' : 'flex-start'};
            align-items: center;
            overflow: hidden;
          }
          #math {
            font-size: ${fontSize}px;
            color: ${color};
            padding: 4px;
            white-space: nowrap;
          }
        </style>
      </head>
      <body>
        <div id="math"></div>
        <script>
          document.addEventListener("DOMContentLoaded", function() {
            try {
              window.katex.render(${JSON.stringify(latex)}, document.getElementById('math'), {
                throwOnError: false,
                displayMode: ${display}
              });
            } catch (err) {
              document.getElementById('math').textContent = ${JSON.stringify(latex)};
            }
          });
        </script>
      </body>
    </html>
  `, [latex, display, color, fontSize]);

  return (
    <View style={display ? styles.blockContainer : styles.inlineContainer}>
      <WebView
        source={{ html: htmlContent }}
        style={styles.webview}
        scrollEnabled={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        androidLayerType="hardware"
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blockContainer: {
    height: 50,
    width: '100%',
    marginVertical: 6,
    backgroundColor: 'transparent',
  },
  inlineContainer: {
    height: 24,
    width: 120,
    backgroundColor: 'transparent',
    display: 'flex',
  },
  webview: {
    backgroundColor: 'transparent',
  },
});
