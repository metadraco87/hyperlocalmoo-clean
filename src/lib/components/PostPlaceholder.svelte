<script lang="ts">
</script>

<div class="post-placeholder">
    <div class="header">
        <div class="avatar"></div>
        <div class="info">
            <div class="username-placeholder"></div>
            <div class="timestamp-placeholder"></div>
        </div>
    </div>
    <div class="content">
        <div class="text-placeholder"></div>
        <div class="text-placeholder short"></div>
    </div>
    <div class="actions">
        <div class="action-placeholder"></div>
        <div class="action-placeholder"></div>
    </div>
</div>

<style>
    .post-placeholder {
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        padding: 16px;
        max-width: 600px;
        margin: 0 auto;
        animation: pulse 1.5s infinite ease-in-out;
    }

    .header {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
    }

    .avatar {
        width: 40px;
        height: 40px;
        background-color: #e5e7eb;
        border-radius: 50%;
        margin-right: 12px;
    }

    .info {
        flex-grow: 1;
    }

    .username-placeholder {
        height: 12px;
        width: 150px;
        background-color: #e5e7eb;
        border-radius: 4px;
        margin-bottom: 6px;
    }

    .timestamp-placeholder {
        height: 10px;
        width: 80px;
        background-color: #f3f4f6;
        border-radius: 4px;
    }

    .content {
        margin-bottom: 12px;
    }

    .text-placeholder {
        height: 10px;
        background-color: #e5e7eb;
        border-radius: 4px;
        margin-bottom: 8px;
    }

    .text-placeholder.short {
        width: 75%;
    }

    .actions {
        display: flex;
        gap: 10px;
    }

    .action-placeholder {
        height: 24px;
        width: 80px;
        background-color: #e5e7eb;
        border-radius: 12px;
    }
    
    @keyframes pulse {
      0% {
        opacity: 1;
      }
      50% {
        opacity: 0.8;
      }
      100% {
        opacity: 1;
      }
    }
</style>