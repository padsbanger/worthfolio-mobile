package com.worthfolio.mobile.widget

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.os.Bundle
import org.json.JSONObject
import java.io.File

/** Runs only on an isolated test installation. Fixtures are never shipped in the app APK. */
class WidgetInstrumentation : Instrumentation() {
  private var preview: String? = null
  override fun onCreate(arguments: Bundle?) { super.onCreate(arguments); preview = arguments?.getString("preview"); start() }
  override fun onStart() {
    val result = Bundle()
    try {
      val context = targetContext
      if (preview != null) {
        check(preview in listOf("masked", "visible", "partial", "large", "expired"))
        val snapshot = JSONObject().put("value", if (preview == "large") "TEST $123,456,789.12" else "TEST $12,345.67")
          .put("pnl", "-TEST $120.00").put("direction", -1).put("asOf", System.currentTimeMillis())
          .put("coverage", if (preview == "partial") "Partial value: 2/3 holdings priced" else "")
        WidgetStore.write(context, JSONObject().put("lease", "instrumentation-fixture-only")
          .put("expiresAt", System.currentTimeMillis() + if (preview == "expired") -1 else 600_000)
          .put("visible", preview != "masked").put("snapshot", snapshot))
        PortfolioWidget.render(context)
        result.putString("stream", "TEST FIXTURE rendered: $preview\n")
        finish(Activity.RESULT_OK, result)
        return
      }
      WidgetStore.clear(context)
      check(WidgetStore.read(context) == null)
      val session = JSONObject().put("lease", "test-account-a").put("expiresAt", System.currentTimeMillis() + 60_000)
        .put("visible", false).put("snapshot", JSONObject().put("value", "TEST 12345.67").put("pnl", "-TEST 20.00").put("asOf", System.currentTimeMillis()))
      WidgetStore.write(context, session)
      val encrypted = File(context.noBackupFilesDir, "widget.enc").readText()
      check(!encrypted.contains("12345.67") && !encrypted.contains("test-account-a"))
      check(WidgetStore.read(context)!!.getJSONObject("snapshot").getString("value") == "TEST 12345.67")
      check(!WidgetStore.read(context)!!.getBoolean("visible"))
      WidgetStore.change(context, "test-account-a") { it.put("visible", true) }
      check(WidgetStore.read(context)!!.getBoolean("visible"))
      var rejected = false
      try { WidgetStore.change(context, "old-account") { it.put("visible", false) } } catch (_: IllegalStateException) { rejected = true }
      check(rejected && WidgetStore.read(context)!!.getBoolean("visible"))
      PortfolioWidget.render(context)
      WidgetStore.write(context, session.put("expiresAt", System.currentTimeMillis() - 1))
      check(WidgetStore.read(context) == null)
      check(!File(context.noBackupFilesDir, "widget.enc").exists())
      WidgetStore.write(context, session.put("expiresAt", System.currentTimeMillis() + 60_000))
      PortfolioWidget().onReceive(context, Intent(Intent.ACTION_BOOT_COMPLETED))
      check(WidgetStore.read(context) == null)
      File(context.noBackupFilesDir, "widget.enc").writeText("corrupt snapshot")
      check(WidgetStore.read(context) == null)
      check(!File(context.noBackupFilesDir, "widget.enc").exists())
      WidgetStore.clear(context)
      PortfolioWidget.render(context)
      result.putString("stream", "PASS: encryption, masked default, visibility, old-session rejection, expiry deletion, reboot clearing, corrupt snapshot recovery, native rendering.\n")
      finish(Activity.RESULT_OK, result)
    } catch (error: Throwable) {
      WidgetStore.clear(targetContext)
      result.putString("stream", "FAIL: ${error.javaClass.simpleName}: ${error.message}\n")
      finish(Activity.RESULT_CANCELED, result)
    }
  }
}
