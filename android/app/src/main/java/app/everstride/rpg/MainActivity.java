package app.everstride.rpg;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(EverstrideHealthPlugin.class);
    super.onCreate(savedInstanceState);
    applyImmersiveGameWindow();
  }

  @Override
  public void onResume() {
    super.onResume();
    applyImmersiveGameWindow();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) applyImmersiveGameWindow();
  }

  private void applyImmersiveGameWindow() {
    // Android's supported immersive mode keeps system navigation available by edge swipe.
    // Do not intercept Back, hide the keyboard, or repeatedly hide bars on inset changes.
    // https://developer.android.com/develop/ui/views/layout/immersive
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    WindowInsetsControllerCompat controller =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    controller.setSystemBarsBehavior(
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    controller.hide(WindowInsetsCompat.Type.systemBars());
  }
}
