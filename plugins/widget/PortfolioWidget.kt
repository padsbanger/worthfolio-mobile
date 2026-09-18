package com.worthfolio.mobile.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import android.util.Base64
import android.view.View
import android.widget.RemoteViews
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import com.worthfolio.mobile.MainActivity
import com.worthfolio.mobile.R
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import java.text.DateFormat
import java.util.Date
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Only a formatted summary and random session lease are retained. Never credentials. */
internal object WidgetStore {
  private const val KEY = "worthfolio.widget.v1"
  fun status(context: Context): String = context.getSharedPreferences("widget_status", Context.MODE_PRIVATE)
    .getString("message", "Open Worthfolio to set up")!!
  private fun file(context: Context) = AtomicFile(File(context.noBackupFilesDir, "widget.enc"))
  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(KEY, null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    }.generateKey()
  }
  @Synchronized fun read(context: Context): JSONObject? {
    val target = file(context)
    if (!target.baseFile.exists()) return null
    return try {
      val envelope = JSONObject(String(target.readFully(), Charsets.UTF_8))
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)))
      val data = JSONObject(String(cipher.doFinal(Base64.decode(envelope.getString("data"), Base64.NO_WRAP)), Charsets.UTF_8))
      if (data.getLong("expiresAt") <= System.currentTimeMillis()) { clear(context, "Session expired · Sign in"); null } else data
    } catch (_: Exception) { clear(context, "Snapshot unavailable · Open app"); null }
  }
  @Synchronized fun write(context: Context, data: JSONObject) {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key())
    val encrypted = cipher.doFinal(data.toString().toByteArray(Charsets.UTF_8))
    val bytes = JSONObject().put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
      .put("data", Base64.encodeToString(encrypted, Base64.NO_WRAP)).toString().toByteArray(Charsets.UTF_8)
    val target = file(context)
    val stream = target.startWrite()
    try { stream.write(bytes); target.finishWrite(stream) } catch (error: Exception) { target.failWrite(stream); throw error }
  }
  @Synchronized fun clear(context: Context, message: String = "Signed out · Open Worthfolio") {
    file(context).delete()
    context.getSharedPreferences("widget_status", Context.MODE_PRIVATE).edit().putString("message", message).commit()
  }
  @Synchronized fun change(context: Context, lease: String, operation: (JSONObject) -> Unit) {
    val data = read(context) ?: throw IllegalStateException("Session unavailable")
    if (data.getString("lease") != lease) throw IllegalStateException("Session changed")
    operation(data)
    write(context, data)
  }
}

class PortfolioWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { render(context) }
  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) { render(context) }
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED) WidgetStore.clear(context, "Open Worthfolio after restart")
    super.onReceive(context, intent)
    if (intent.action == EXPIRE || intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) render(context)
  }
  companion object {
    private const val EXPIRE = "com.worthfolio.mobile.WIDGET_EXPIRE"
    fun schedule(context: Context, expiresAt: Long?) {
      val alarm = context.getSystemService(AlarmManager::class.java)
      val pending = PendingIntent.getBroadcast(context, 45, Intent(context, PortfolioWidget::class.java).setAction(EXPIRE),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      alarm.cancel(pending)
      if (expiresAt != null) alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, expiresAt, pending)
    }
    @Synchronized fun render(context: Context) {
      val data = WidgetStore.read(context)
      val snapshot = data?.optJSONObject("snapshot")
      val shown = data?.optBoolean("visible", false) == true
      val manager = AppWidgetManager.getInstance(context)
      val text = context.getColor(R.color.widget_foreground)
      val muted = context.getColor(R.color.widget_muted)
      val intent = Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(Uri.parse("worthfolio:///"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      val open = PendingIntent.getActivity(context, 44, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      for (id in manager.getAppWidgetIds(ComponentName(context, PortfolioWidget::class.java))) {
        val views = RemoteViews(context.packageName, R.layout.portfolio_widget)
        views.setOnClickPendingIntent(R.id.widget_root, open)
        val compact = context.resources.configuration.fontScale > 1.2f ||
          manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 300) < 300
        views.setViewVisibility(R.id.widget_brand, if (compact) View.GONE else View.VISIBLE)
        for (view in intArrayOf(R.id.widget_value, R.id.widget_pnl)) views.setTextColor(view, text)
        for (view in intArrayOf(R.id.widget_time, R.id.widget_status)) views.setTextColor(view, muted)
        views.setTextViewText(R.id.widget_value, when { data == null -> WidgetStore.status(context); snapshot == null -> "Open app to load"; !shown -> "Balances hidden"; else -> snapshot.optString("value", "Unavailable") })
        val value = snapshot?.optString("value", "Unavailable") ?: ""
        views.setTextViewTextSize(R.id.widget_value, android.util.TypedValue.COMPLEX_UNIT_SP,
          if (!shown || snapshot == null) 22f else if (compact) 24f else if (value.length > 14) 26f else 32f)
        val direction = snapshot?.optInt("direction") ?: 0
        val arrow = if (direction > 0) "\u2197 " else if (direction < 0) "\u2198 " else ""
        val pnl = if (shown && snapshot != null) "Open P&L  $arrow${snapshot.optString("pnl", "Unavailable")}" else "Tap to open portfolio"
        views.setTextViewText(R.id.widget_pnl, pnl)
        if (shown && snapshot != null) {
          views.setTextColor(R.id.widget_pnl, if (direction == 0) muted else context.getColor(if (direction > 0) R.color.widget_positive else R.color.widget_negative))
        }
        val time = snapshot?.optLong("asOf", 0) ?: 0
        views.setTextViewText(R.id.widget_time, if (snapshot == null) "No saved portfolio snapshot" else if (time <= 0) "Snapshot time unavailable" else "Snapshot: ${DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(time))}")
        val coverage = if (shown) snapshot?.optString("coverage", "") ?: "" else ""
        val coverageLabel = if (compact) coverage.replace("Partial value:", "Partial:").replace(" holdings priced", " priced") else coverage
        views.setTextViewText(R.id.widget_status, if (coverage.isNotEmpty()) "$coverageLabel · Not live" else "Open app to refresh · Not live")
        views.setViewVisibility(R.id.widget_time, if (data == null) View.GONE else View.VISIBLE)
        manager.updateAppWidget(id, views)
      }
      schedule(context, data?.getLong("expiresAt"))
    }
  }
}

class WidgetModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "WorthfolioWidget"
  private fun run(promise: Promise, action: () -> Any?) {
    try { promise.resolve(action()) } catch (_: Exception) { promise.reject("WIDGET_UNAVAILABLE", "Widget operation could not be completed.") }
  }
  @ReactMethod fun activate(lease: String, expiresAt: Double, promise: Promise) = run(promise) {
    WidgetStore.clear(context)
    if (expiresAt > System.currentTimeMillis()) WidgetStore.write(context, JSONObject().put("lease", lease).put("expiresAt", expiresAt.toLong()).put("visible", false))
    PortfolioWidget.render(context); null
  }
  @ReactMethod fun clear(promise: Promise) = run(promise) { WidgetStore.clear(context); PortfolioWidget.render(context); null }
  @ReactMethod fun publish(lease: String, snapshot: String, promise: Promise) = run(promise) {
    val incoming = JSONObject(snapshot)
    require(snapshot.length < 4096)
    WidgetStore.change(context, lease) { it.put("snapshot", incoming) }
    PortfolioWidget.render(context); null
  }
  @ReactMethod fun visibility(lease: String, visible: Boolean, promise: Promise) = run(promise) {
    WidgetStore.change(context, lease) { it.put("visible", visible) }
    PortfolioWidget.render(context); null
  }
  @ReactMethod fun isVisible(promise: Promise) = run(promise) { WidgetStore.read(context)?.optBoolean("visible", false) ?: false }
  @ReactMethod fun pin(promise: Promise) = run(promise) {
    val manager = AppWidgetManager.getInstance(context)
    if (Build.VERSION.SDK_INT >= 26 && manager.isRequestPinAppWidgetSupported) manager.requestPinAppWidget(ComponentName(context, PortfolioWidget::class.java), null, null) else false
  }
}

class WidgetPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(WidgetModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
