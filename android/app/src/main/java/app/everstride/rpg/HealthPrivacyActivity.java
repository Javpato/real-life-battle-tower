package app.everstride.rpg;
import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;
public class HealthPrivacyActivity extends Activity {
  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    TextView text = new TextView(this);
    text.setPadding(32,48,32,32); text.setTextSize(18);
    text.setText("Everstride health permissions\n\nSteps power your adventure. Optional sleep, active energy and weight readings can be previewed and imported into your diary. No medical advice or nutrition AI is provided.\n\nHealth data is read on this device. Importing does not upload it automatically. When cloud diary sharing is enabled, all devices you link can read and edit your diary. Camera video stays on your device.\n\nYou may revoke permissions in Android Settings at any time. Missing readings are shown as unavailable, never invented.");
    setContentView(text);
  }
}
