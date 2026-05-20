from synapse.module_api import ModuleApi
import logging

logger = logging.getLogger(__name__)

class OnRegisterWebhook:
    def __init__(self, config: dict, api: ModuleApi):
        self._api = api
        self._webhook_url = config.get("webhook_url")
        logger.info(f"OnRegisterWebhook loaded successfully, webhook_url: {self._webhook_url}")

        api.register_account_validity_callbacks(
            on_user_registration=self.on_user_registration
        )

    async def on_user_registration(self, user_id: str):
        logger.info(f"on_user_registration triggered for {user_id}")
        try:
            response = await self._api.http_client.post_json_get_json(
                self._webhook_url,
                post_json={
                    "user_id": user_id,
                    "action": "init_user_projects"
                }
            )
            logger.info(f"Webhook sent successfully: {response}")
        except Exception as e:
            logger.error(f"An error occured while sending the webhook: {e}")

    @staticmethod
    def parse_config(config: dict):
        return config
